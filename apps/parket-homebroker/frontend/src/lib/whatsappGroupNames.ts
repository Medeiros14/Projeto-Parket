/**
 * Mapa de JIDs de grupos WhatsApp → nome do grupo.
 * Gerado a partir das 3 instâncias Evolution (Parket / Comercial / Secretaria).
 * Use displayChatName(phone, senderName) pra renderizar conversas no chat.
 *
 * Atualizar via: curl conect.parket.works/group/fetchAllGroups + script de geração.
 */
export const GROUP_NAME_BY_JID: Record<string, string> = {
  "120363027594166464@g.us": "Agrosil",
  "120363045460731521@g.us": "Neoamazon 🌳",
  "120363113617158529@g.us": "PARKET OFFICE ",
  "120363277530439249@g.us": "Móveis para o RS. Grupo de Sc",
  "120363315404807737@g.us": "SALE ATE 80%! 🔥",
  "120363350750628980@g.us": "Parket & Alfabag ",
  "120363399087091511@g.us": "Brascomm Processos Parket",
  "120363399698326495@g.us": "Parket ",
  "120363400102839152@g.us": "Sistema Brascomm - Parket",
  "120363400535840563@g.us": "Marketplace Hunter - Parket",
  "120363402568234614@g.us": "METAS COMERCIAL",
  "120363403677413499@g.us": "LNB - Notificação",
  "120363403827909243@g.us": "📍CONTATOS N",
  "120363404249243540@g.us": "Trends - MKT Esportivo",
  "120363405460675664@g.us": "📋 Parket - PMO",
  "120363405634674702@g.us": "👥 Parket - RH",
  "120363405833976929@g.us": "OBRA - JULIO BAPTISTA",
  "120363405953096954@g.us": "Trends - News",
  "120363405979905444@g.us": "🤖 Parket IA",
  "120363406305316103@g.us": "Trends - Nicho",
  "120363406795322179@g.us": "📐 Parket - Projetos",
  "120363406875159606@g.us": "Parket WoodPlanner",
  "120363406891667575@g.us": "LEADS",
  "120363407134075532@g.us": "💰 Parket - Financeiro",
  "120363407367929089@g.us": "🎧 Parket - Atendimento",
  "120363407853011178@g.us": "Investimento Douglas",
  "120363408101356171@g.us": "Lead Matriz - SPV",
  "120363410634646059@g.us": "OFFICE",
  "120363413097816849@g.us": "NOVOS CONTATOS",
  "120363417773894933@g.us": "CONTATOS NI📌",
  "120363418908798059@g.us": "Mkt parket 💣 🚀 💥",
  "120363419286716694@g.us": "FK- PRÉ AGENDAMENTO - VISAGISMO",
  "120363420196658189@g.us": "Utopia: Parket",
  "120363420472269656@g.us": "PARKET - FRANCISCO BALESTRINI ANDRADE",
  "120363421770695273@g.us": "Comercial Parket",
  "120363421835162512@g.us": "ORÇAMENTOS - ADITIVOS",
  "120363423419485190@g.us": "Injex IA - Dev Squad",
  "120363423690432580@g.us": "🏢 Parket — Comercial",
  "120363424274425530@g.us": "Trends - Cultura",
  "120363424427063107@g.us": "Fiscal Will - Teste",
  "120363425017967171@g.us": "🚛 Parket - Logística",
  "120363425107346389@g.us": "Parket - Gestão Douglas",
  "120363425314205066@g.us": "Parket — Orçamentos",
  "120363425524935203@g.us": "Parket - Producao",
  "120363425769227152@g.us": "📊 Parket - Fiscal",
  "120363426906654777@g.us": "Parket — UX",
  "120363427046305569@g.us": "🏗 Parket - Obras",
  "120363427283309459@g.us": "🛒 Parket - Compras",
  "120363427680402717@g.us": "Fiscal Cristiano",
  "120363427716933978@g.us": "Fiscal Alvaro",
  "120363429858464475@g.us": "Fiscal Davi",
};

/**
 * Decide o nome a mostrar no card de conversa.
 * - Se for grupo (@g.us): nome do grupo OU fallback "Grupo · sender"
 * - Caso contrário: senderName ou número formatado
 */
export function displayChatName(phone: string | null | undefined, senderName?: string | null): string {
  if (!phone) return senderName || "—";
  if (phone.endsWith("@g.us")) {
    const groupName = GROUP_NAME_BY_JID[phone];
    if (groupName) return groupName;
    return senderName ? `👥 Grupo · ${senderName}` : "👥 Grupo WhatsApp";
  }
  return senderName || `WhatsApp +${phone.replace(/\D/g, "")}`;
}
