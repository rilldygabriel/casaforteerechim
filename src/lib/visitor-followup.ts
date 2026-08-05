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

export function getVisitorFollowupStep(stepKey: string) {
  return VISITOR_FOLLOWUP_STEPS[stepKey as VisitorFollowupStepKey] ?? null;
}
