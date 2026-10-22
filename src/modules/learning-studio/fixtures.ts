import type { StudioDocument } from "./types";

/**
 * Synthetic teaching material written for the prototype (generic textbook facts,
 * no real course, no personal or company data). Real documents will come from
 * the academic-workspace ingestion pipeline.
 */
export const SYNTHETIC_DOCUMENTS: readonly StudioDocument[] = [
  {
    id: "syn-reseaux-ch1-osi",
    title: "Modèle OSI et encapsulation",
    subjectId: "reseaux",
    subjectLabel: "Réseaux",
    chapter: "Chapitre 1",
    docType: "COURS",
    version: 1,
    synthetic: true,
    classification: "PUBLIC",
    pages: [
      { pageNumber: 1, passages: [
        { id: "p1-a", text: "Le modèle OSI est un modèle de référence qui découpe la communication réseau en sept couches. Chaque couche rend un service à la couche supérieure et utilise les services de la couche inférieure." },
        { id: "p1-b", text: "Les sept couches sont la couche physique, la liaison de données, le réseau, le transport, la session, la présentation et l’application." },
      ] },
      { pageNumber: 2, passages: [
        { id: "p2-a", text: "L’encapsulation est le mécanisme par lequel chaque couche ajoute son propre en-tête aux données reçues de la couche supérieure. La décapsulation est l’opération inverse réalisée par le destinataire, qui retire les en-têtes couche par couche." },
        { id: "p2-b", text: "Une PDU désigne l’unité de données manipulée par une couche : trame pour la liaison, paquet pour le réseau, segment pour le transport." },
      ] },
      { pageNumber: 3, passages: [
        { id: "p3-a", text: "La couche transport assure le transfert de bout en bout entre deux applications. Un port identifie une application sur une machine." },
        { id: "p3-b", text: "TCP est un protocole de transport orienté connexion qui garantit l’ordre et la fiabilité des données. UDP est un protocole de transport sans connexion, plus léger, utilisé lorsque la latence compte davantage que la fiabilité." },
      ] },
    ],
  },
  {
    id: "syn-reseaux-td2-ipv4",
    title: "TD — Adressage IPv4",
    subjectId: "reseaux",
    subjectLabel: "Réseaux",
    chapter: "Chapitre 2",
    docType: "TD",
    version: 1,
    synthetic: true,
    classification: "PUBLIC",
    pages: [
      { pageNumber: 1, passages: [
        { id: "p1-a", text: "Une adresse IPv4 est un identifiant de 32 bits noté en quatre octets décimaux. Le masque de sous-réseau sert à séparer la partie réseau de la partie hôte d’une adresse." },
        { id: "p1-b", text: "Exercice 1 : pour l’adresse 192.168.10.37/24, déterminer l’adresse du réseau et l’adresse de diffusion." },
      ] },
      { pageNumber: 2, passages: [
        { id: "p2-a", text: "Correction : avec un masque /24, l’adresse du réseau est 192.168.10.0 et l’adresse de diffusion est 192.168.10.255. Le nombre d’hôtes utilisables dans un réseau /24 est de 254." },
        { id: "p2-b", text: "La passerelle par défaut est l’adresse du routeur vers lequel une machine envoie les paquets destinés à d’autres réseaux." },
      ] },
    ],
  },
  {
    id: "syn-bdd-ch1-cles",
    title: "Clés et contraintes",
    subjectId: "bdd",
    subjectLabel: "Bases de données",
    chapter: "Chapitre 1",
    docType: "COURS",
    version: 1,
    synthetic: true,
    classification: "PUBLIC",
    pages: [
      { pageNumber: 1, passages: [
        { id: "p1-a", text: "Une clé primaire est un attribut ou un ensemble d’attributs qui identifie de manière unique chaque ligne d’une table. Une clé étrangère est un attribut qui fait référence à la clé primaire d’une autre table." },
        { id: "p1-b", text: "L’intégrité référentielle garantit qu’une clé étrangère pointe toujours vers une ligne existante." },
      ] },
      { pageNumber: 2, passages: [
        { id: "p2-a", text: "Une contrainte NOT NULL interdit l’absence de valeur dans une colonne. Une contrainte UNIQUE garantit que deux lignes ne partagent pas la même valeur dans une colonne." },
        { id: "p2-b", text: "Une cardinalité exprime le nombre minimal et maximal d’occurrences d’une entité liées à une autre dans un MCD." },
      ] },
    ],
  },
];
