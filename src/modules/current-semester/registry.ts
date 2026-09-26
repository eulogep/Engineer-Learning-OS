/*
 * PUBLIC SAMPLE DATA.
 *
 * The course structure and concept lists follow a public programme. Teacher names, exam dates,
 * project context and the learner's self-assessment are placeholders: the real semester state is a
 * local-only file (`knowledge/current-semester/CURRENT_SEMESTER_STATE.md`, ignored by Git) and is
 * never committed. Replace these values locally if you want your own planning.
 */
import type {
  BaselineClaim,
  ConceptScope,
  ExamScope,
  SemesterBacklogItem,
  SemesterConcept,
  SemesterCourse,
  SemesterExamMode,
  SemesterProvenance,
  SemesterStateRevision,
} from "./types";

export const CURRENT_SEMESTER_PROVENANCE: SemesterProvenance = Object.freeze({
  sourceId: "CURRENT_SEMESTER_STATE_2026_2027",
  sourceReference: "CURRENT_SEMESTER_STATE.md",
  sourceUpdatedAt: "2026-09-14",
});

const concept = (id: string, label: string, scope: ConceptScope = "CURRENT_COURSE",
  examScope: ExamScope = "PROBABLE", baselineClaim: BaselineClaim | null = null): SemesterConcept => Object.freeze({
  id, label, scope, examScope, baselineClaim, provenance: CURRENT_SEMESTER_PROVENANCE,
});
const backlog = (id: string, label: string, kind: SemesterBacklogItem["kind"], conceptIds: readonly string[] = []): SemesterBacklogItem => Object.freeze({
  id, label, kind, conceptIds: Object.freeze([...conceptIds]), provenance: CURRENT_SEMESTER_PROVENANCE,
});
const course = (value: Omit<SemesterCourse, "provenance">): SemesterCourse => Object.freeze({ ...value, provenance: CURRENT_SEMESTER_PROVENANCE });

const webConcepts = [
  concept("WEB_CLIENT_SERVER", "Client / serveur"), concept("WEB_STATIC_DYNAMIC", "Statique / dynamique"),
  concept("WEB_HTML_CSS", "HTML / CSS"), concept("WEB_PHP_SERVER", "PHP côté serveur"),
  concept("WEB_MAMP_LOCALHOST", "MAMP / localhost", "CURRENT_COURSE", "PROBABLE", "DECLARED_STABLE"),
  concept("WEB_PHP_VARIABLES", "Variables PHP", "CURRENT_COURSE", "PROBABLE", "DECLARED_CONSOLIDATE"),
  concept("WEB_CONDITIONS", "Conditions if / else"), concept("WEB_LOOPS", "Boucles while / for"),
  concept("WEB_FORMS", "Formulaires HTML", "CURRENT_COURSE", "CONFIRMED", "DECLARED_CONSOLIDATE"),
  concept("WEB_POST", "Méthode POST et $_POST", "CURRENT_COURSE", "CONFIRMED"),
  concept("WEB_PHP_MYSQL", "Connexion PHP / MySQL", "CURRENT_COURSE", "CONFIRMED"),
  concept("WEB_MYSQLI_CONNECT", "mysqli_connect"), concept("WEB_MYSQLI_QUERY", "mysqli_query"),
  concept("WEB_MYSQLI_FETCH_ASSOC", "mysqli_fetch_assoc", "CURRENT_COURSE", "PROBABLE"),
  concept("WEB_MYSQLI_NUM_ROWS", "mysqli_num_rows"), concept("WEB_SELECT", "SELECT", "CURRENT_COURSE", "CONFIRMED"),
  concept("WEB_WHERE", "WHERE"), concept("WEB_SESSION_START", "session_start"),
  concept("WEB_SESSION", "$_SESSION", "CURRENT_COURSE", "CONFIRMED"),
  concept("WEB_PAGE_PROTECTION", "Protection de page", "CURRENT_COURSE", "CONFIRMED"),
  concept("WEB_LOGIN_FLOW", "Flux de connexion", "CURRENT_COURSE", "CONFIRMED"),
];

const sqlConcepts = [
  concept("SQL_DATA", "Donnée"), concept("SQL_INFORMATION", "Information"), concept("SQL_DATABASE", "Base de données"),
  concept("SQL_DBMS", "SGBD", "CURRENT_COURSE", "PROBABLE"),
  concept("SQL_ENTITY_ASSOCIATION", "Modèle Entité-Association", "CURRENT_COURSE", "PROBABLE"),
  concept("SQL_ENTITY", "Entité"), concept("SQL_ASSOCIATION", "Association"), concept("SQL_ATTRIBUTE", "Attribut"),
  concept("SQL_IDENTIFIER", "Identifiant"), concept("SQL_CARDINALITY", "Cardinalités", "CURRENT_COURSE", "PROBABLE"),
  concept("SQL_RELATIONAL_MODEL", "Modèle relationnel", "CURRENT_COURSE", "PROBABLE"),
  concept("SQL_TABLE", "Table"), concept("SQL_PRIMARY_KEY", "Clé primaire", "CURRENT_COURSE", "PROBABLE"),
  concept("SQL_FOREIGN_KEY", "Clé étrangère", "CURRENT_COURSE", "PROBABLE"),
  concept("SQL_DDL", "DDL / LDD"), concept("SQL_DML", "DML / LMD"), concept("SQL_DCL", "DCL / LCD"),
  concept("SQL_CREATE_TABLE", "CREATE TABLE", "CURRENT_COURSE", "PROBABLE"),
  concept("SQL_INSERT", "INSERT", "CURRENT_COURSE", "PROBABLE"), concept("SQL_SELECT", "SELECT"),
  concept("SQL_NOT_NULL", "NOT NULL"), concept("SQL_UNIQUE", "UNIQUE"), concept("SQL_CHECK", "CHECK"),
  concept("SQL_REFERENCES", "REFERENCES"),
  concept("SQL_JOIN", "JOIN", "PROGRAM_SCOPE_ONLY", "UNCONFIRMED"),
  concept("SQL_GROUP_BY", "GROUP BY", "PROGRAM_SCOPE_ONLY", "UNCONFIRMED"),
  concept("SQL_HAVING", "HAVING", "PROGRAM_SCOPE_ONLY", "UNCONFIRMED"),
  concept("SQL_ADVANCED_AGGREGATES", "Agrégations avancées", "PROGRAM_SCOPE_ONLY", "UNCONFIRMED"),
];

const projectConcepts = ["Opportunité", "Faisabilité", "Cahier des charges", "Cycle de vie", "Validation", "Recette / réception", "Livraison", "Risques", "Qualité", "Comparaison de solutions", "Critères de test", "Justification du projet"]
  .map((label, index) => concept(`PROJECT_${index + 1}`, label, "CURRENT_COURSE", "NOT_APPLICABLE"));
const communicationConcepts = ["CV", "Entretien", "Communication professionnelle", "Présentation orale", "Rédaction technique", "Rapport technique", "Référencement de figure", "Problème / solution", "Résultats", "Validation", "Conclusion / perspectives", "Adaptation au lecteur"]
  .map((label, index) => concept(`COMMUNICATION_${index + 1}`, label, "CURRENT_COURSE", "NOT_APPLICABLE"));

const networkCurrent = [
  concept("NETWORK_OSI", "OSI", "CURRENT_COURSE", "UNCONFIRMED"),
  concept("NETWORK_TCP_IP", "TCP/IP", "CURRENT_COURSE", "UNCONFIRMED"),
  concept("NETWORK_ENCAPSULATION", "Encapsulation", "CURRENT_COURSE", "UNCONFIRMED"),
  concept("NETWORK_LAYER_RESPONSIBILITIES", "Responsabilités des couches", "CURRENT_COURSE", "UNCONFIRMED"),
];
const networkProgramme = ["Ethernet", "ARP", "Routage", "ICMP", "UDP", "TCP", "DNS", "DHCP", "NAT", "Wi-Fi", "VLAN", "Routage dynamique", "STP", "Interconnexion", "OSPF", "BGP", "EIGRP"]
  .map((label) => concept(`NETWORK_PROGRAM_${label.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`, label, "PROGRAM_SCOPE_ONLY", "UNCONFIRMED"));
const systemProgramme = ["Unix / Linux", "Utilisateurs", "Groupes", "Permissions", "Logs", "Boot", "Systèmes de fichiers", "Virtualisation", "VMware / ESXi", "Windows Server", "Active Directory", "GPO", "PowerShell"]
  .map((label) => concept(`SYSTEM_PROGRAM_${label.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`, label, "PROGRAM_SCOPE_ONLY", "UNCONFIRMED"));
const englishConcepts = ["Présentation personnelle", "Pitch", "Présentation investisseur", "Présentation de projet", "Vocabulaire professionnel", "Slides", "Phrases courtes", "Prise de parole sans lecture"]
  .map((label, index) => concept(`ENGLISH_${index + 1}`, label, "CURRENT_COURSE", "NOT_APPLICABLE"));

export const CURRENT_SEMESTER_STATE: SemesterStateRevision = Object.freeze({
  semesterId: "LICENCE_PRO_RESEAUX_CYBERSECURITE_2026_2027", revision: 1, status: "ACTIVE",
  updatedAt: "2026-09-14", source: CURRENT_SEMESTER_PROVENANCE,
  courses: Object.freeze([
    course({ id: "COURSE_WEB_DATABASE", slug: "web-database", title: "Base de données WEB", professor: "Enseignant exemple", priority: "P0", currentCourseState: "CONFIRMED", examDate: "2027-01-11",
      examNotes: Object.freeze(["Exemple : notes d’évaluation à renseigner localement"]), context: "Exemple de contexte de cours", tracks: Object.freeze([]),
      preferredPracticeModes: Object.freeze(["Code prediction", "Output prediction", "Form → POST → PHP → SQL tracing", "Login / session tracing", "Mini coding", "Exam drills"]), concepts: Object.freeze(webConcepts),
      backlog: Object.freeze([
        backlog("WEB_OUTPUT_PREDICTION", "Prédire la sortie de cinq mini-programmes PHP", "PRACTICE", ["WEB_PHP_VARIABLES", "WEB_CONDITIONS", "WEB_LOOPS"]),
        backlog("WEB_FORM_REBUILD", "Reconstruire un formulaire simple sans modèle", "PRACTICE", ["WEB_FORMS", "WEB_POST"]),
        backlog("WEB_FORM_SQL", "Écrire une recherche SQL à partir d’un formulaire", "PRACTICE", ["WEB_FORMS", "WEB_POST", "WEB_PHP_MYSQL", "WEB_WHERE"]),
        backlog("WEB_SESSION_PROTECTION", "Protéger une page avec $_SESSION", "PRACTICE", ["WEB_SESSION_START", "WEB_SESSION", "WEB_PAGE_PROTECTION", "WEB_LOGIN_FLOW"]),
        backlog("WEB_TD_MULTI_TABLES", "Refaire un TD multi-tables", "PRACTICE", ["WEB_PHP_MYSQL", "WEB_MYSQLI_QUERY", "WEB_MYSQLI_FETCH_ASSOC"]),
        backlog("WEB_MOCK_EXAM", "Faire un mini-examen blanc Web", "ASSESSMENT", ["WEB_PHP_VARIABLES", "WEB_FORMS", "WEB_SESSION"]),
      ]) }),
    course({ id: "COURSE_SQL_DATABASE", slug: "sql-database", title: "Base de données SQL", professor: "Enseignant exemple", priority: "P1", currentCourseState: "CONFIRMED", examDate: "2027-01-18",
      examNotes: Object.freeze(["Exemple : notes d’évaluation à renseigner localement"]), context: null, tracks: Object.freeze([]), preferredPracticeModes: Object.freeze(["Cardinality drills", "MCD → relational mapping", "CREATE TABLE", "Valid / invalid INSERT", "Timed exam drills"]), concepts: Object.freeze(sqlConcepts),
      backlog: Object.freeze([
        backlog("SQL_CARDINALITY_DRILLS", "Résoudre dix mini-cas de cardinalités", "PRACTICE", ["SQL_CARDINALITY"]),
        backlog("SQL_MCD_MAPPING", "Convertir cinq MCD simples en tables", "PRACTICE", ["SQL_ENTITY_ASSOCIATION", "SQL_RELATIONAL_MODEL", "SQL_PRIMARY_KEY", "SQL_FOREIGN_KEY"]),
        backlog("SQL_CREATE_TABLE_DRILL", "Écrire CREATE TABLE sans modèle", "PRACTICE", ["SQL_CREATE_TABLE", "SQL_NOT_NULL", "SQL_UNIQUE", "SQL_CHECK", "SQL_REFERENCES"]),
        backlog("SQL_INSERT_VALIDITY", "Distinguer les INSERT valides et invalides", "PRACTICE", ["SQL_INSERT", "SQL_PRIMARY_KEY", "SQL_FOREIGN_KEY"]),
        backlog("SQL_RECALL", "Faire un quiz SQL de rappel", "ASSESSMENT", ["SQL_DDL", "SQL_DML", "SQL_DCL"]),
        backlog("SQL_MOCK_EXAM", "Faire un examen blanc SQL chronométré", "ASSESSMENT", ["SQL_CARDINALITY", "SQL_CREATE_TABLE", "SQL_INSERT"]),
      ]) }),
    course({ id: "COURSE_NETWORK_ARCHITECTURE", slug: "network-architecture", title: "Architecture des Réseaux", professor: "Enseignant exemple", priority: "P2", currentCourseState: "PARTIAL", examDate: null, examNotes: Object.freeze(["Exemple : notes d’évaluation à renseigner localement"]), context: "Exemple de contexte de cours", tracks: Object.freeze([]), preferredPracticeModes: Object.freeze(["Retrieval", "Diagram reconstruction", "Protocol contrast", "Diagnostic exercises"]), concepts: Object.freeze([...networkCurrent, ...networkProgramme]),
      backlog: Object.freeze([backlog("NETWORK_COLLECT_SESSION", "Intégrer le cours et les exercices d’une séance", "SOURCE_COLLECTION"), backlog("NETWORK_OSI_MAP", "Produire une carte OSI / TCP-IP", "PRACTICE", ["NETWORK_OSI", "NETWORK_TCP_IP", "NETWORK_LAYER_RESPONSIBILITIES"]), backlog("NETWORK_ENCAPSULATION_DRILL", "Faire des exercices d’encapsulation", "PRACTICE", ["NETWORK_ENCAPSULATION"])]) }),
    course({ id: "COURSE_SYSTEM_ADMIN", slug: "system-administration", title: "Administration des systèmes", professor: "Enseignant exemple", priority: "P2", currentCourseState: "SOURCE_COLLECTION_NEEDED", examDate: null, examNotes: Object.freeze(["Exemple : notes d’évaluation à renseigner localement"]), context: "Exemple de contexte de cours", tracks: Object.freeze([]), preferredPracticeModes: Object.freeze(["Command sheet", "Mini labs", "Practical verification"]), concepts: Object.freeze(systemProgramme),
      backlog: Object.freeze([backlog("SYSTEM_TRANSCRIPTS", "Analyser les transcriptions système", "SOURCE_COLLECTION"), backlog("SYSTEM_COMMANDS", "Extraire les commandes et séparer théorie / manipulation", "SOURCE_COLLECTION"), backlog("SYSTEM_LABS", "Préparer des mini-labs après confirmation des sources", "SOURCE_COLLECTION")]) }),
    course({ id: "COURSE_PROJECT_MANAGEMENT", slug: "project-management", title: "Gestion de Projet", professor: "Enseignant exemple", priority: "P3", currentCourseState: "CONFIRMED", examDate: null, examNotes: Object.freeze(["Exemple : notes d’évaluation à renseigner localement"]), context: "Exemple de contexte de cours", tracks: Object.freeze([]), preferredPracticeModes: Object.freeze(["Project-grounded writing", "Solution comparison", "Acceptance criteria"]), concepts: Object.freeze(projectConcepts),
      backlog: Object.freeze([backlog("PROJECT_PROBLEM", "Identifier une problématique réelle du projet", "PROJECT"), backlog("PROJECT_COMPARE", "Comparer et justifier les solutions", "PROJECT"), backlog("PROJECT_TESTS", "Définir les tests avant réalisation", "PROJECT"), backlog("PROJECT_DELIVERY", "Documenter ce qui est effectivement réalisé", "PROJECT")]) }),
    course({ id: "COURSE_COMMUNICATION", slug: "communication", title: "Communication", professor: "Enseignant exemple", priority: "P3", currentCourseState: "CONFIRMED", examDate: null, examNotes: Object.freeze(["Exemple : notes d’évaluation à renseigner localement"]), context: "Exemple de contexte de cours", tracks: Object.freeze([]), preferredPracticeModes: Object.freeze(["Paragraph rewrite", "Precise heading", "Figure explanation", "Project-specific writing", "Two-minute oral"]), concepts: Object.freeze(communicationConcepts),
      backlog: Object.freeze([backlog("COMM_REWRITE", "Réécrire un paragraphe trop scolaire", "COMMUNICATION"), backlog("COMM_HEADING", "Créer un titre précis", "COMMUNICATION"), backlog("COMM_FIGURE", "Créer une légende et une référence de figure", "COMMUNICATION"), backlog("COMM_REPORT", "Produire un mini-rapport technique", "COMMUNICATION"), backlog("COMM_ORAL", "Expliquer un sujet technique en deux minutes", "COMMUNICATION")]) }),
    course({ id: "COURSE_ENGLISH", slug: "english", title: "Anglais", professor: "Enseignant exemple", priority: "P3", currentCourseState: "CONFIRMED", examDate: null, examNotes: Object.freeze(["Exemple : notes d’évaluation à renseigner localement"]), context: "Exemple de contexte de cours", tracks: Object.freeze(["GENERAL_ENGLISH", "TECHNICAL_ENGLISH", "PROFESSIONAL_PRESENTATION_ENGLISH"]), preferredPracticeModes: Object.freeze(["Explain OSI in English", "Describe a SQL query", "Explain an incident", "Present a project", "Unexpected technical question"]), concepts: Object.freeze(englishConcepts),
      backlog: Object.freeze([backlog("ENGLISH_PROJECT_PITCH", "Présenter un projet en 60 secondes", "COMMUNICATION"), backlog("ENGLISH_NETWORK", "Expliquer un schéma réseau en anglais", "COMMUNICATION"), backlog("ENGLISH_INCIDENT", "Expliquer un incident technique", "COMMUNICATION"), backlog("ENGLISH_UNEXPECTED", "Répondre sans lire à une question imprévue", "COMMUNICATION")]) }),
  ]),
});

export const CURRENT_SEMESTER_HISTORY = Object.freeze([CURRENT_SEMESTER_STATE]);

export const SEMESTER_EXAM_MODES: readonly SemesterExamMode[] = Object.freeze([
  Object.freeze({ id: "WEB_EXAM_MODE", courseId: "COURSE_WEB_DATABASE", title: "Préparation examen Web",
    activityTypes: Object.freeze(["Short concept recall", "PHP code reading", "Output prediction", "Form flow", "PHP / SQL flow", "Session flow", "Mini coding"]),
    conceptIds: Object.freeze(["WEB_PHP_VARIABLES", "WEB_CONDITIONS", "WEB_LOOPS", "WEB_FORMS", "WEB_POST", "WEB_PHP_MYSQL", "WEB_SESSION", "WEB_PAGE_PROTECTION"]),
    evidencePolicy: "REUSE_CANONICAL_ELOS_HISTORY", masteryPolicy: "EVIDENCE_REQUIRED", provenance: CURRENT_SEMESTER_PROVENANCE }),
  Object.freeze({ id: "SQL_EXAM_MODE", courseId: "COURSE_SQL_DATABASE", title: "Préparation examen SQL",
    activityTypes: Object.freeze(["Cardinality drills", "MCD → relational mapping", "PK / FK", "CREATE TABLE", "Constraints", "Valid / invalid INSERT", "SQL recall", "Timed exam drills"]),
    conceptIds: Object.freeze(["SQL_CARDINALITY", "SQL_ENTITY_ASSOCIATION", "SQL_RELATIONAL_MODEL", "SQL_PRIMARY_KEY", "SQL_FOREIGN_KEY", "SQL_CREATE_TABLE", "SQL_INSERT"]),
    evidencePolicy: "REUSE_CANONICAL_ELOS_HISTORY", masteryPolicy: "EVIDENCE_REQUIRED", provenance: CURRENT_SEMESTER_PROVENANCE }),
]);
