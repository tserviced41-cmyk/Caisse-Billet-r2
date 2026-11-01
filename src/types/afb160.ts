export interface DonneurOrdre {
  nom: string; // 24 chars max
  banque: string; // 5 digits
  guichet: string; // 5 digits
  compte: string; // 11 alphanumeric chars
  cle: string; // 2 digits
  dateExecution: string; // YYYY-MM-DD or DD/MM/YYYY, mapped to JJMMAA
  libelle: string; // Optional default motif/libellé (31 chars max)
  referenceEmetteur?: string; // 12 chars (default: '000000000000')
}

export interface OperationVirement {
  id: string;
  rang: string; // e.g. '000001' or '00230'
  banque: string; // 5 digits
  guichet: string; // 5 digits
  compte: string; // 11 alphanumeric
  cle: string; // 2 digits
  nom: string; // Nom et Prénoms (24 chars max)
  libelle: string; // Libellé / Motif de l'opération (31 chars max)
  montant: number; // Montant en MGA (Ariary)
}

export interface AFB160FileConfig {
  donneur: DonneurOrdre;
  operations: OperationVirement[];
}
