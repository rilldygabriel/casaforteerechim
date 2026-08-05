export const VISITOR_FOLLOWUP_STEPS = {
  monday_message: {
    title: "Mensagem de segunda-feira",
    description: "Dar boas-vindas e perguntar como a pessoa está depois da visita.",
    whatsappMessage: "Foi muito bom receber você! Como você está depois da sua visita?",
  },
  thursday_message: {
    title: "Mensagem de quinta-feira",
    description: "Manter o contato e demonstrar que a Casa continua disponível.",
    whatsappMessage: "Passamos para dizer que estamos à disposição e queremos continuar perto de você.",
  },
  next_service_invite: {
    title: "Convite para o próximo culto",
    description: "Convidar pessoalmente para estar novamente com a Casa.",
    whatsappMessage: "Queremos convidar você para estar conosco no próximo culto. Vai ser uma alegria receber você novamente!",
  },
  following_week_contact: {
    title: "Contato da semana seguinte",
    description: "Confirmar se a pessoa está sendo acompanhada e registrar as demandas.",
    whatsappMessage: "Como foi sua semana? Queremos saber como podemos acompanhar e ajudar você.",
  },
} as const;

export type VisitorFollowupStepKey = keyof typeof VISITOR_FOLLOWUP_STEPS;

const WEDNESDAY_VISIT_STEPS = {
  monday_message: { title: "Boas-vindas de quinta-feira", description: "Agradecer pela presença no culto de quarta e perguntar como foi a experiência.", whatsappMessage: "Foi muito bom receber você no culto de quarta-feira! Como foi sua experiência conosco?" },
  thursday_message: { title: "Convite para o culto de domingo", description: "Fazer um convite pessoal para o culto de domingo.", whatsappMessage: "Queremos convidar você para estar conosco no culto de domingo. Será uma alegria receber você novamente!" },
  next_service_invite: { title: "Contato da quarta-feira seguinte", description: "Retomar o contato e fazer um novo convite para o próximo culto.", whatsappMessage: "Passamos para saber como você está e também para convidar você para o próximo culto da Casa." },
  following_week_contact: { title: "Mensagem de cuidado — 10 dias", description: "Perguntar como a pessoa está e identificar se precisa de acompanhamento, oração ou ajuda.", whatsappMessage: "Como você está? Queremos caminhar perto e saber se podemos ajudar ou orar por alguma situação." },
} as const;

const SUNDAY_VISIT_STEPS = {
  monday_message: VISITOR_FOLLOWUP_STEPS.monday_message,
  thursday_message: VISITOR_FOLLOWUP_STEPS.thursday_message,
  next_service_invite: { ...VISITOR_FOLLOWUP_STEPS.next_service_invite, title: "Convite para o culto de domingo" },
  following_week_contact: { ...VISITOR_FOLLOWUP_STEPS.following_week_contact, title: "Mensagem de cuidado — 10 dias", description: "Dez dias depois da visita, perguntar como a pessoa está e identificar suas necessidades." },
} as const;

export function getVisitorFollowupRoute(visitDate: string) {
  const [year, month, day] = visitDate.split("-").map(Number);
  const isWednesday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 3;
  return {
    label: isWednesday ? "Roteiro · Visitou na quarta-feira" : "Roteiro · Visitou no domingo",
    description: isWednesday
      ? "Boas-vindas na quinta, convite para domingo, contato na quarta seguinte e cuidado no décimo dia."
      : "Boas-vindas na segunda, contato na quinta, convite para domingo e cuidado no décimo dia.",
    steps: isWednesday ? WEDNESDAY_VISIT_STEPS : SUNDAY_VISIT_STEPS,
  } as const;
}

export function getVisitorFollowupStep(stepKey: string, visitDate?: string) {
  const steps = visitDate ? getVisitorFollowupRoute(visitDate).steps : VISITOR_FOLLOWUP_STEPS;
  return steps[stepKey as VisitorFollowupStepKey] ?? null;
}
