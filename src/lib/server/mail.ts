import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";

type MailSocket = Socket | TLSSocket;

function smtpHost() {
  return process.env.SMTP_HOST?.trim() ?? "";
}

export function smtpConfigured() {
  return Boolean(smtpHost() && process.env.MAIL_FROM?.trim());
}

function isMailbox(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
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

export async function sendVerificationLink(input: { to: string; link: string }) {
  if (!smtpConfigured()) {
    console.info(`Verification link (SMTP is not configured): ${input.link}`);
    return { sent: false as const };
  }
  const to = input.to.trim();
  const from = process.env.MAIL_FROM?.trim() ?? "";
  if (!isMailbox(to) || !isMailbox(from)) {
    console.info(`Verification link (mail address was not usable): ${input.link}`);
    return { sent: false as const };
  }
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
    await session.command(`RCPT TO:<${to}>`, "250");
    await session.command("DATA", "354");
    const body = [
      `From: ${from}`,
      `To: ${to}`,
      "Subject: Confirm your XVAIsle email",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Confirm this email address for XVAIsle:",
      input.link,
      "",
    ]
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");
    socket.write(`${body}\r\n.\r\n`);
    const accepted = await session.read();
    if (!accepted.startsWith("250")) throw new Error("The mail server did not accept the message.");
    socket.write("QUIT\r\n");
    return { sent: true as const };
  } catch (error) {
    console.info(`Verification link (mail was not sent): ${input.link}`);
    const message = error instanceof Error ? error.message : "Mail was not sent.";
    console.error(message);
    return { sent: false as const };
  } finally {
    socket.end();
  }
}
