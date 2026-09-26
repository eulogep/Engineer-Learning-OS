# Agent source policy

1. Lire `index.json` avant ingestion.
2. Préserver le fichier original et sa provenance.
3. Ne jamais inférer qu'un sujet de PROGRAM_SCOPE a été enseigné.
4. Ne jamais convertir une déclaration de maîtrise en maîtrise canonique.
5. Ne jamais envoyer `LOCAL_ONLY`, `UNKNOWN_BLOCKED`, secrets ou credentials à distance.
6. Toute extraction dérivée doit être stockée séparément et pointer vers la source originale.
7. En cas de contradiction, privilégier la source officielle/récente et consigner la contradiction.
