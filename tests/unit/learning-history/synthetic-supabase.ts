import { validateSyncEnvelope, type SyncAck, type SyncEnvelope } from "../../../src/modules/learning-history/sync/protocol";

type Device = { user: string; learnerRef: string; credential: string; revoked: boolean };

export class SyntheticSupabaseGateway {
  readonly #tokens = new Map([
    ["synthetic.session.token.user.a.000000", "user-a"],
    ["synthetic.session.token.user.b.000000", "user-b"],
  ]);
  readonly #learners = new Map<string, string>();
  readonly #devices = new Map<string, Device>();
  readonly #envelopes = new Map<string, SyncEnvelope>();
  readonly #acks = new Map<string, SyncAck>();
  readonly #idempotency = new Map<string, SyncAck>();
  readonly #requestIds = new Set<string>();
  sequence = 0;

  readonly fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const operation = url.slice(url.lastIndexOf("/") + 1);
    const headers = new Headers(init?.headers);
    if (!headers.get("apikey")?.startsWith("sb_publishable_")) return this.#response({}, 401);
    const token = headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const user = this.#tokens.get(token);
    if (!user) return this.#response({}, 401);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const learnerRef = String(body.p_learner_ref);
    const deviceId = String(body.p_device_id);
    const credential = String(body.p_device_credential);
    if (operation === "elos_register_device") {
      const owner = this.#learners.get(learnerRef);
      const previous = this.#devices.get(deviceId);
      if ((owner && owner !== user) || previous?.revoked
        || (previous && (previous.user !== user || previous.credential !== credential))) {
        return this.#response({}, 403);
      }
      this.#learners.set(learnerRef, user);
      this.#devices.set(deviceId, { user, learnerRef, credential, revoked: false });
      return this.#response({ status: "REGISTERED", mode: "SHADOW" });
    }
    const device = this.#devices.get(deviceId);
    if (!device || device.user !== user || device.learnerRef !== learnerRef
      || device.credential !== credential || device.revoked) {
      return this.#response({}, 403);
    }
    if (operation === "elos_sync_health") {
      return this.#response({ status: "HEALTHY", schemaVersion: 8, mode: "SHADOW" });
    }
    if (operation === "elos_revoke_device") {
      const target = this.#devices.get(String(body.p_target_device_id));
      if (!target || target.user !== user || target.learnerRef !== learnerRef) {
        return this.#response({}, 403);
      }
      target.revoked = true;
      return this.#response({ status: "REVOKED", deviceId: String(body.p_target_device_id) });
    }
    if (operation === "elos_sync_upload") {
      let envelope: SyncEnvelope;
      try {
        envelope = await validateSyncEnvelope(body.p_envelope);
      } catch {
        return this.#response({}, 400);
      }
      if (envelope.event.learnerRef !== learnerRef || envelope.event.deviceRef !== deviceId) {
        return this.#response({}, 403);
      }
      const identity = user + ":" + envelope.event.id;
      const jobIdentity = user + ":" + envelope.job.id;
      const idemIdentity = user + ":" + envelope.job.idempotencyKey;
      const previous = this.#acks.get(identity)
        ?? this.#acks.get(jobIdentity)
        ?? this.#idempotency.get(idemIdentity);
      if (previous) {
        return previous.digest === envelope.digest
          && previous.eventId === envelope.event.id
          && previous.jobId === envelope.job.id
          ? this.#response(previous)
          : this.#response({}, 409);
      }
      const requestIdentity = deviceId + ":" + String(body.p_request_id);
      if (this.#requestIds.has(requestIdentity)) return this.#response({}, 409);
      this.#requestIds.add(requestIdentity);
      this.sequence++;
      const ack: SyncAck = {
        version: 1,
        jobId: envelope.job.id,
        eventId: envelope.event.id,
        idempotencyKey: envelope.job.idempotencyKey,
        digest: envelope.digest,
        checkpoint: {
          streamId: learnerRef,
          token: String(body.p_request_id),
          sequence: this.sequence,
        },
      };
      this.#envelopes.set(identity, envelope);
      this.#acks.set(identity, ack);
      this.#acks.set(jobIdentity, ack);
      this.#idempotency.set(idemIdentity, ack);
      return this.#response(ack);
    }
    if (operation === "elos_sync_pull") {
      const after = body.p_after as SyncAck["checkpoint"] | null;
      const offset = after?.sequence ?? 0;
      if (after && (after.streamId !== learnerRef || offset > this.sequence)) {
        return this.#response({}, 400);
      }
      const all = [...this.#envelopes.entries()]
        .filter(([key]) => key.startsWith(user + ":"))
        .map(([, value]) => value);
      const limit = Number(body.p_limit);
      const values = all.slice(offset, offset + limit);
      const end = offset + values.length;
      const tokenAtEnd = end === 0 ? learnerRef : [...this.#idempotency.values()]
        .find((ack) => ack.checkpoint.sequence === end)?.checkpoint.token ?? learnerRef;
      return this.#response({
        envelopes: values,
        checkpoint: { streamId: learnerRef, token: tokenAtEnd, sequence: end },
        hasMore: end < all.length,
      });
    }
    return this.#response({}, 404);
  };

  #response(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
}
