import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";

type MailSocket = Socket | TLSSocket;

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

type MailDelivery = (message: MailMessage) => Promise<void>;

let deliveryOverride: MailDelivery | null = null;
let captured: MailMessage[] | null = null;

export function setMailDelivery(delivery: MailDelivery | null) {
  deliveryOverride = delivery;
}

export function startMailCapture() {
  captured = [];
  return captured;
}

export function stopMailCapture() {
  const messages = captured ?? [];
  captured = null;
  return messages;
}

function smtpHost() {
  return process.env.SMTP_HOST?.trim() ?? "";
}

export function smtpConfigured() {
  return Boolean(smtpHost() && process.env.MAIL_FROM?.trim());
}

function isMailbox(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function headerValue(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

class SmtpSession {
  private buffer = "";
  private wait: ((chunk: string) => void) | null = null;
  private readonly onData = (chunk: Buffer) => {
    this.buffer += chunk.toString("utf8");
    this.wake();
  };

  constructor(private socket: MailSocket) {
    socket.on("data", this.onData);
  }

  detach() {
    this.socket.off("data", this.onData);
  }

  private wake() {
    if (!this.wait) return;
    const lines = this.buffer.split(/\r?\n/).filter((line) => line.length > 0);
    const last = lines[lines.length - 1] ?? "";
    if (!/^\d{3} /.test(last)) return;
    const reply = this.buffer;
    this.buffer = "";
    const resolve = this.wait;
    this.wait = null;
    resolve(reply);
  }

  read() {
    const ready = this.buffer.split(/\r?\n/).filter((line) => line.length > 0);
    const last = ready[ready.length - 1] ?? "";
    if (/^\d{3} /.test(last)) {
      const reply = this.buffer;
      this.buffer = "";
      return Promise.resolve(reply);
    }
    return new Promise<string>((resolve, reject) => {
      this.wait = resolve;
      this.socket.once("error", reject);
    });
  }

  async command(line: string, ok: string) {
    this.socket.write(`${line}\r\n`);
    const reply = await this.read();
    if (!reply.startsWith(ok)) throw new Error("The mail server refused the message.");
    return reply;
  }

  close() {
    this.socket.end();
  }
}

function openSocket(host: string, port: number, secure: boolean) {
  return new Promise<MailSocket>((resolve, reject) => {
    const socket = secure ? tlsConnect({ host, port, servername: host }) : netConnect({ host, port });
    socket.once("error", reject);
    socket.once(secure ? "secureConnect" : "connect", () => resolve(socket));
  });
}

function upgrade(socket: Socket, host: string) {
  return new Promise<TLSSocket>((resolve, reject) => {
    const secure = tlsConnect({ socket, servername: host });
    secure.once("secureConnect", () => resolve(secure));
    secure.once("error", reject);
  });
}

async function smtpSend(message: MailMessage, from: string) {
  const host = smtpHost();
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const implicitTls = port === 465;
  let socket = await openSocket(host, Number.isInteger(port) ? port : 587, implicitTls);
  let session = new SmtpSession(socket);
  try {
    const greeting = await session.read();
    if (!greeting.startsWith("220")) throw new Error("The mail server did not greet.");
    await session.command("EHLO xvaisle", "250");
    if (!implicitTls) {
      await session.command("STARTTLS", "220");
      session.detach();
      socket = await upgrade(socket as Socket, host);
      session = new SmtpSession(socket);
      await session.command("EHLO xvaisle", "250");
    }
    if (user) {
      await session.command("AUTH LOGIN", "334");
      await session.command(Buffer.from(user).toString("base64"), "334");
      await session.command(Buffer.from(pass).toString("base64"), "235");
    }
    await session.command(`MAIL FROM:<${from}>`, "250");
    await session.command(`RCPT TO:<${message.to}>`, "250");
    await session.command("DATA", "354");
    const body = [
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      message.text,
    ]
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");
    socket.write(`${body}\r\n.\r\n`);
    const accepted = await session.read();
    if (!accepted.startsWith("250")) throw new Error("The mail server did not accept the message.");
    socket.write("QUIT\r\n");
  } finally {
    socket.end();
  }
}

export async function sendMail(input: MailMessage) {
  const message: MailMessage = {
    to: headerValue(input.to),
    subject: headerValue(input.subject).slice(0, 200),
    text: input.text.slice(0, 20_000),
  };
  captured?.push(message);
  try {
    if (deliveryOverride) {
      await deliveryOverride(message);
      return { sent: true as const };
    }
    const from = headerValue(process.env.MAIL_FROM ?? "");
    if (!smtpConfigured() || !isMailbox(message.to) || !isMailbox(from)) {
      console.info(`Mail not sent (SMTP is not configured): ${message.subject} to ${message.to || "unset"}`);
      return { sent: false as const };
    }
    await smtpSend(message, from);
    return { sent: true as const };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Mail was not sent.";
    console.error(detail);
    return { sent: false as const };
  }
}

export async function sendVerificationLink(input: { to: string; link: string }) {
  const result = await sendMail({
    to: input.to,
    subject: "Confirm your XVAIsle email",
    text: `Confirm this email address for XVAIsle:\n${input.link}\n`,
  });
  if (!result.sent) console.info(`Verification link (mail was not sent): ${input.link}`);
  return result;
}
