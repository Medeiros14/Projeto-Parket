// Stub — o chat "Dadá" usava um gateway de IA do Hercules que não existe mais.
// O front (components/dada/dada-chat.tsx) espera uma STRING como resposta:
//   const response = await dadaChat({ messages: history }); // response.length, content: response

export const chat = async (_args: { messages: Array<{ role: string; content: string }> }): Promise<string> => {
  return "A Teca ainda não está disponível nesta versão do app. Em breve!";
};
