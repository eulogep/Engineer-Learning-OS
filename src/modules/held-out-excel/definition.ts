export const heldOutExcelDefinition = {
  id: "excel-csv-held-out-transfer-v1",
  version: 1,
  title: "Épreuve autonome — CSV inconnu",
  datasetHref: "/training-data/excel-csv-foundations/held-out/plant-readings.csv",
  datasetName: "plant-readings.csv",
  classification: "TRAINING_SYNTHETIC" as const,
  instructions: [
    "Importe le fichier dans Excel sans rouvrir le tutoriel.",
    "Identifie le délimiteur qui produit cinq colonnes cohérentes.",
    "Signale l’identifiant de la ligne dont la mesure d’énergie est absente.",
    "Explique brièvement comment l’aperçu d’import confirme ton diagnostic.",
  ],
};
