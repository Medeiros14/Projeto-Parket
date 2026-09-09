/**
 * ContratoAssinado — página de retorno pós-assinatura DocuSign.
 *
 * Acessada via redirect do DocuSign quando o signatário termina de assinar.
 * URL: /contrato/assinado?event=signing_complete
 *
 * Eventos possíveis em `?event=`:
 *   - signing_complete: assinou com sucesso
 *   - cancel: cancelou no meio do processo
 *   - decline: recusou
 *   - exception: erro
 *   - viewing_complete: visualizou (não signer)
 *   - ttl_expired: link expirou
 */
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

type EventType =
  | "signing_complete"
  | "cancel"
  | "decline"
  | "exception"
  | "viewing_complete"
  | "ttl_expired"
  | "session_timeout"
  | "id_check_failed"
  | "access_code_failed";

interface EventInfo {
  icon: any;
  color: string;
  title: string;
  message: string;
}

const EVENT_INFO: Record<string, EventInfo> = {
  signing_complete: {
    icon: CheckCircle2,
    color: "#10b981",
    title: "Contrato assinado com sucesso!",
    message: "Seja bem-vindo à Parket! Nossa equipe foi notificada e você receberá uma cópia do contrato assinado no seu email em instantes.",
  },
  viewing_complete: {
    icon: CheckCircle2,
    color: "#10b981",
    title: "Documento visualizado",
    message: "Você visualizou o documento com sucesso.",
  },
  cancel: {
    icon: XCircle,
    color: "#f59e0b",
    title: "Assinatura cancelada",
    message: "Você fechou a tela antes de concluir. Se precisar, abra o link novamente — ele continua válido (dentro do prazo).",
  },
  decline: {
    icon: XCircle,
    color: "#ef4444",
    title: "Contrato recusado",
    message: "Você recusou a assinatura. Nossa equipe foi notificada e entrará em contato para entender o motivo.",
  },
  exception: {
    icon: AlertTriangle,
    color: "#ef4444",
    title: "Algo deu errado",
    message: "Ocorreu um erro ao processar a assinatura. Por favor, tente abrir o link novamente ou entre em contato com a Parket.",
  },
  ttl_expired: {
    icon: Clock,
    color: "#dc2626",
    title: "Link expirado",
    message: "Este link de assinatura expirou. Solicite um novo link com a equipe da Parket que enviou o contrato.",
  },
  session_timeout: {
    icon: Clock,
    color: "#dc2626",
    title: "Sessão expirou",
    message: "Sua sessão expirou. Por favor, abra o link de assinatura novamente.",
  },
  id_check_failed: {
    icon: AlertTriangle,
    color: "#ef4444",
    title: "Verificação de identidade falhou",
    message: "Não foi possível verificar sua identidade. Entre em contato com a Parket.",
  },
  access_code_failed: {
    icon: AlertTriangle,
    color: "#ef4444",
    title: "Código de acesso incorreto",
    message: "O código de acesso digitado está incorreto. Tente novamente.",
  },
};

export function ContratoAssinadoPage() {
  const [event, setEvent] = useState<string>("signing_complete");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("event");
    if (e) setEvent(e);
  }, []);

  const info = EVENT_INFO[event] || EVENT_INFO.signing_complete;
  const Icon = info.icon;
  const ok = event === "signing_complete" || event === "viewing_complete";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #1a1410 0%, #0a0a0a 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#18181b",
          border: `2px solid ${info.color}30`,
          borderRadius: 16,
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: `0 10px 60px ${info.color}15`,
        }}
      >
        {/* Logo / marca */}
        <div
          style={{
            display: "inline-block",
            padding: "8px 18px",
            border: "1px solid #3f3f46",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: "0.18em",
            color: "#a1a1aa",
            fontWeight: 700,
            marginBottom: 32,
          }}
        >
          PARKET · ARQUITETURA EM MADEIRA
        </div>

        {/* Ícone */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: `${info.color}20`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Icon size={42} style={{ color: info.color }} strokeWidth={2} />
        </div>

        {/* Título */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 12px",
            lineHeight: 1.3,
          }}
        >
          {info.title}
        </h1>

        {/* Mensagem */}
        <p
          style={{
            fontSize: 14,
            color: "#a1a1aa",
            lineHeight: 1.6,
            margin: "0 0 28px",
          }}
        >
          {info.message}
        </p>

        {/* Próximos passos (só se sucesso) */}
        {ok && (
          <div
            style={{
              textAlign: "left",
              background: "#0a0a0a",
              border: "1px solid #27272a",
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "#71717a",
                fontWeight: 700,
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              Próximos passos
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                color: "#d4d4d8",
                fontSize: 12,
                lineHeight: 1.8,
              }}
            >
              <li>Você receberá uma cópia do contrato assinado por email (DocuSign)</li>
              <li>Nossa equipe Financeira foi notificada e iniciará o cronograma</li>
              <li>Em breve você receberá contato sobre os próximos passos do projeto</li>
            </ul>
          </div>
        )}

        {/* Botão site */}
        <a
          href="https://parket.com.br"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: ok ? "#eab308" : "#27272a",
            color: ok ? "#0a0a0a" : "#a1a1aa",
            textDecoration: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          Visitar parket.com.br →
        </a>

        {/* Rodapé */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid #27272a",
            fontSize: 10,
            color: "#52525b",
            lineHeight: 1.6,
          }}
        >
          Dúvidas? Entre em contato pelo email{" "}
          <a
            href="mailto:financeiro@parket.com.br"
            style={{ color: "#a1a1aa", textDecoration: "none" }}
          >
            financeiro@parket.com.br
          </a>
          <br />
          Assinatura digital protegida por DocuSign
        </div>
      </div>
    </div>
  );
}
