export type MinistryLeader = {
  name: string;
  phone: string;
};

export type Ministry = {
  key: string;
  label: string;
  leaders: MinistryLeader[];
};

export const MINISTRIES: Ministry[] = [
  {
    key: "louvor",
    label: "Louvor",
    leaders: [
      { name: "Herrison", phone: "54999468558" },
      { name: "Pamela", phone: "54999468565" },
    ],
  },
  {
    key: "connect_recepcao",
    label: "Connect — Recepção",
    leaders: [
      { name: "Sidi", phone: "54999241833" },
      { name: "Raquel", phone: "54981158194" },
    ],
  },
  {
    key: "connect_consolidacao",
    label: "Connect — Consolidação",
    leaders: [
      { name: "Sidi", phone: "54999241833" },
      { name: "Raquel", phone: "54981158194" },
    ],
  },
  {
    key: "casa_kids",
    label: "Casa Kids",
    leaders: [
      { name: "Elisson", phone: "54991985156" },
      { name: "Tai", phone: "54991393511" },
    ],
  },
  {
    key: "midias_fotos",
    label: "Mídias — Fotos",
    leaders: [{ name: "Rarissa", phone: "54999147014" }],
  },
  {
    key: "midias_stories",
    label: "Mídias — Stories",
    leaders: [{ name: "Karen", phone: "54999630023" }],
  },
  {
    key: "midias_transmissao",
    label: "Mídias — Transmissão",
    leaders: [{ name: "Wesley", phone: "54999532705" }],
  },
  {
    key: "intercessao",
    label: "Intercessão",
    leaders: [{ name: "Eli", phone: "54991460455" }],
  },
  {
    key: "cozinha",
    label: "Cozinha",
    leaders: [{ name: "Eli", phone: "54991460455" }],
  },
  {
    key: "mesa_de_som",
    label: "Mesa de Som",
    leaders: [
      { name: "Marco", phone: "54992568998" },
      { name: "Cezar", phone: "54999787358" },
    ],
  },
];

export function findMinistry(key: string) {
  return MINISTRIES.find((ministry) => ministry.key === key) ?? null;
}
