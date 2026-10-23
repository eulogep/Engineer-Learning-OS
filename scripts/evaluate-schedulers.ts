// Replays real review logs (open-spaced-repetition fsrs-dataset TSV format, MIT)
// through the ELOS scheduler evaluator: FSRS-4.5 default weights vs the current
// ELOS Leitner ladder. Usage:
//   node --experimental-strip-types --import ./tests/register-loader.mjs scripts/evaluate-schedulers.ts <file.tsv>...
// Data files are not versioned; download them from
// https://huggingface.co/datasets/open-spaced-repetition/fsrs-dataset (folder v4).
import { readFileSync } from "node:fs";
import path from "node:path";
import { replaySchedulers, type ReviewEvent } from "../src/modules/scientific-pedagogy/replay.ts";

function parse(file: string): ReviewEvent[] {
  const [header, ...lines] = readFileSync(file, "utf8").trim().split("\n");
  const columns = header.split("\t");
  const at = columns.indexOf("review_time");
  const card = columns.indexOf("card_id");
  const rating = columns.indexOf("review_rating");
  if (at < 0 || card < 0 || rating < 0) throw new Error(`Unexpected columns in ${file}`);
  return lines.map((line) => {
    const cells = line.split("\t");
    // Anki rating 1 = "Again" (forgotten); 2–4 = recalled.
    return { itemId: cells[card], at: Number(cells[at]), success: Number(cells[rating]) > 1 };
  });
}

const rows = process.argv.slice(2).map((file) => ({ user: path.basename(file).replace(/\.tsv$/, ""), report: replaySchedulers(parse(file)) }));
let wins = 0;
const totals = { CURRENT_V1: { logLoss: 0, brier: 0 }, FSRS_4_5: { logLoss: 0, brier: 0 } };
let predictions = 0;
console.log("user\tpredictions\tobserved\tLeitner logloss\tFSRS logloss\tLeitner brier\tFSRS brier");
for (const { user, report } of rows) {
  const [leitner, fsrs] = report.scores;
  if (fsrs.logLoss < leitner.logLoss) wins += 1;
  for (const score of report.scores) {
    totals[score.scheduler].logLoss += score.logLoss * score.predictions;
    totals[score.scheduler].brier += score.brier * score.predictions;
  }
  predictions += report.predictions;
  console.log([user, report.predictions, fsrs.observedRecall, leitner.logLoss, fsrs.logLoss, leitner.brier, fsrs.brier].join("\t"));
}
const weighted = (scheduler: keyof typeof totals, metric: "logLoss" | "brier") => (totals[scheduler][metric] / predictions).toFixed(4);
console.log(`\nweighted over ${predictions} predictions: Leitner logloss ${weighted("CURRENT_V1", "logLoss")} / FSRS ${weighted("FSRS_4_5", "logLoss")} · Leitner brier ${weighted("CURRENT_V1", "brier")} / FSRS ${weighted("FSRS_4_5", "brier")}`);
console.log(`FSRS-4.5 has the lower log-loss for ${wins}/${rows.length} users`);
