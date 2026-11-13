// Lois et règles de l'association, affichées dans Paramètres › Lois et règles.
// Pour modifier le texte : ajouter / changer des sections et des articles ci-dessous.

export interface Article {
  titre?: string; // ex. « Cotisation »
  texte: string; // le contenu de la règle (sauts de ligne conservés)
}

export interface SectionReglement {
  titre: string; // ex. « Chapitre 1 — Les membres »
  articles: Article[];
}

export const reglement = {
  // Date de la dernière mise à jour du règlement (format AAAA-MM-JJ), ou null
  misAJourLe: "2026-11-13" as string | null,
  introduction:
    "Ce règlement fixe le fonctionnement de la caisse de l'association Fottal : l'adhésion des membres, " +
    "les cotisations, les réunions, les aides en cas de maladie ou de décès et la garde de l'argent. " +
    "Il s'applique à tous les membres.",
  sections: [
    {
      titre: "Chapitre 1 — Les membres",
      articles: [
        {
          titre: "Adhésion",
          texte:
            "Chaque membre est inscrit avec son nom, son prénom et sa date d'adhésion. " +
            "Son téléphone, son email et sa ville peuvent être ajoutés.",
        },
        {
          titre: "Bolondha",
          texte:
            "Chaque membre peut être rattaché à une bolondha (par exemple Kourasadio, Kowly ou Ngioguiyabhe). " +
            "La liste des bolondhas est tenue par l'administrateur.",
        },
        {
          titre: "Membre actif ou inactif",
          texte:
            "Seuls les membres actifs doivent des cotisations. " +
            "Un membre déclaré inactif ne doit plus rien à partir de ce moment.",
        },
      ],
    },
    {
      titre: "Chapitre 2 — Les cotisations",
      articles: [
        {
          titre: "Montant",
          texte:
            "La cotisation est de 15 € par mois. Les réunions ayant lieu tous les deux mois, " +
            "chaque membre doit 30 € par réunion.",
        },
        {
          titre: "Début des cotisations",
          texte: "Un membre doit la cotisation de chaque réunion qui a lieu à partir de sa date d'adhésion.",
        },
        {
          titre: "Versements",
          texte:
            "Un membre peut verser plus ou moins que la cotisation selon ses moyens (par exemple 15 €, 30 € ou 50 €). " +
            "Le versement peut se faire en espèces, par virement ou par un autre moyen.",
        },
        {
          titre: "Retards",
          texte:
            "Un versement sert d'abord à rattraper les retards les plus anciens, puis à payer la réunion du jour.\n" +
            "Exemple : un membre qui doit encore 15 € sur la réunion précédente et qui verse 45 € règle les 15 € de retard " +
            "et les 30 € de la réunion du jour.",
        },
        {
          titre: "Avance",
          texte: "Ce qui est versé en plus de ce qui est dû est gardé comme avance sur les réunions suivantes.",
        },
        {
          titre: "Membre à jour",
          texte:
            "Un membre est à jour lorsque le total de ses versements couvre toutes les cotisations dues depuis son adhésion. " +
            "Sinon, la différence constitue son reste dû.",
        },
      ],
    },
    {
      titre: "Chapitre 3 — Les réunions",
      articles: [
        {
          titre: "Fréquence",
          texte: "L'association se réunit tous les deux mois. La date de la réunion suivante est fixée environ deux mois après la précédente.",
        },
        {
          titre: "Encaissement",
          texte: "Les cotisations sont encaissées pendant la réunion. Chaque versement est enregistré au nom du membre qui paie.",
        },
      ],
    },
    {
      titre: "Chapitre 4 — Les aides",
      articles: [
        {
          titre: "Cas pris en charge",
          texte: "L'association peut verser une aide en cas de maladie ou de décès, ou dans un autre cas décidé en réunion.",
        },
        {
          titre: "Bénéficiaire",
          texte: "L'aide peut être versée à un membre de l'association ou à une personne extérieure.",
        },
        {
          titre: "Montant",
          texte:
            "Le montant de chaque aide est décidé lors de la réunion. " +
            "Il est pris sur les cotisations encaissées à cette réunion et ne peut pas dépasser l'argent disponible.",
        },
      ],
    },
    {
      titre: "Chapitre 5 — La garde de l'argent",
      articles: [
        {
          titre: "Restant",
          texte: "À la fin de chaque réunion, on calcule le restant : cotisations encaissées moins aides versées.",
        },
        {
          titre: "Remise du restant",
          texte:
            "Le restant est confié à un ou plusieurs membres, qui repartent avec l'argent. " +
            "Le nom de chaque personne, le montant qui lui est confié et la date sont enregistrés.",
        },
      ],
    },
    {
      titre: "Chapitre 6 — La gestion de la caisse",
      articles: [
        {
          titre: "Administrateur",
          texte:
            "L'administrateur gère les membres, les réunions et les bolondhas : il peut les ajouter, les modifier et les supprimer.",
        },
        {
          titre: "Agent",
          texte:
            "L'agent consulte toutes les informations. Il encaisse les cotisations, enregistre les aides " +
            "et la remise du restant.",
        },
      ],
    },
  ] as SectionReglement[],
};
