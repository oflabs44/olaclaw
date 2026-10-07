import { env, exports } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import type { TodayEvent } from "./agent";
import type { ChatSummary } from "./chats";
import { DESK_HUES, DESK_ICONS, MAX_DESK_BRIEF_LENGTH, MAX_DESK_NAME_LENGTH } from "./desk-look";
import type { Desk, DeskNote } from "./desks";
import type { MemoryEntry } from "./memory";
import { AGENT_NAME } from "./protocol";

// Everything here comes from the user's agent object.

/** A decision the assistant asked for, shown in the approvals panel. It waits until `decision` is set. */
export type Approval = {
	/** The id of the `ask` or `desk_propose_brief` tool call that asked. */
	readonly id: string;
	readonly chatId: string;
	readonly question: string;
	readonly detail?: string;
	readonly options: readonly string[];
	/** Set when the answer decides on code, for example what an `ayo_execute` call wants to run. */
	readonly codeLineCount?: number;
	/** The Ayo capabilities that code names, as a label for the history. */
	readonly codeCalls?: readonly string[];
	readonly decision?: string;
	readonly createdAt: number;
	readonly decidedAt?: number;
};

/** A decided approval in full. `code` is the text Oladayo read before he answered. */
export type DecidedApproval = Approval & {
	readonly code?: string;
	readonly decision: string;
	readonly decidedAt: number;
};

function userAgent() {
	return exports.PiAgent.getByName(AGENT_NAME);
}

export const getChats = createServerFn().handler((): Promise<ChatSummary[]> => userAgent().listChats());

export const getChat = createServerFn()
	.validator(z.object({ chatId: z.string() }))
	.handler(async ({ data }): Promise<ChatSummary> => {
		const chats = await userAgent().listChats();
		const chat = chats.find((candidate) => candidate.id === data.chatId);
		if (!chat) throw notFound();
		return chat;
	});

export const createChat = createServerFn({ method: "POST" }).handler(
	(): Promise<ChatSummary> => userAgent().createChat(),
);

export const forkChat = createServerFn({ method: "POST" })
	.validator(z.object({ chatId: z.string(), entryId: z.string() }))
	.handler(({ data }): Promise<ChatSummary> => userAgent().forkChat(data.chatId, data.entryId));

export const setChatModel = createServerFn({ method: "POST" })
	.validator(z.object({ chatId: z.string(), model: z.string() }))
	.handler(({ data }): Promise<void> => userAgent().setChatModel(data.chatId, data.model));

// A desk id is a row id. Other spellings of the same number, such as "1.0", must not reach SQLite, which would take them.
const deskId = z.string().regex(/^[1-9][0-9]{0,15}$/);

const deskInput = z.object({
	name: z.string().trim().min(1).max(MAX_DESK_NAME_LENGTH),
	brief: z.string().trim().max(MAX_DESK_BRIEF_LENGTH),
	hue: z.enum(DESK_HUES),
	icon: z.enum(DESK_ICONS),
});

export const getDesks = createServerFn().handler((): Promise<Desk[]> => userAgent().listDesks());

export const createDesk = createServerFn({ method: "POST" })
	.validator(deskInput)
	.handler(({ data }): Promise<Desk> => userAgent().createDesk(data));

export const updateDesk = createServerFn({ method: "POST" })
	.validator(deskInput.extend({ deskId }))
	.handler(async ({ data: { deskId, ...input } }): Promise<void> => {
		if (!(await userAgent().updateDesk(deskId, input))) throw notFound();
	});

/** A brief that Phoebe writes from the desk's name and a rough description of the job. It is not saved. */
export const draftDeskBrief = createServerFn({ method: "POST" })
	.validator(deskInput.pick({ name: true }).extend({ description: z.string().trim().min(1).max(MAX_DESK_BRIEF_LENGTH) }))
	.handler(({ data }): Promise<string> => userAgent().draftDeskBrief(data.name, data.description));

/** A desk with its notebook, oldest note first. */
export const getDesk = createServerFn()
	// The id comes from the URL, so one of the wrong form is a page that does not exist, not a failed load.
	.validator(z.object({ deskId: z.string() }))
	.handler(async ({ data }): Promise<{ desk: Desk; notes: DeskNote[] }> => {
		if (!deskId.safeParse(data.deskId).success) throw notFound();
		const desk = await userAgent().getDesk(data.deskId);
		if (!desk) throw notFound();
		return desk;
	});

export const removeDeskNote = createServerFn({ method: "POST" })
	.validator(z.object({ deskId, noteId: z.number().int() }))
	.handler(({ data }): Promise<void> => userAgent().removeDeskNote(data.deskId, data.noteId));

/** A new chat at the desk, already running on `text`. */
export const startDeskChat = createServerFn({ method: "POST" })
	.validator(z.object({ deskId, text: z.string().trim().min(1) }))
	.handler(({ data }): Promise<ChatSummary> => userAgent().startDeskChat(data.deskId, data.text));

/** The waiting approvals first, then the decided ones, newest first. Without the code: see `getDecidedApproval`. */
export const getApprovals = createServerFn().handler(async (): Promise<Approval[]> => {
	const approvals = await userAgent().listApprovals();
	return approvals.map((approval) => ({
		id: approval.callId,
		chatId: approval.sessionId,
		question: approval.question,
		detail: approval.detail ?? undefined,
		options: approval.options,
		codeLineCount: approval.codeLineCount ?? undefined,
		codeCalls: approval.codeCalls,
		decision: approval.decision ?? undefined,
		createdAt: approval.createdAt,
		decidedAt: approval.decidedAt ?? undefined,
	}));
});

/** Null for an approval that does not exist or still waits: a waiting one shows its code only in its chat. */
export const getDecidedApproval = createServerFn()
	.validator(z.object({ callId: z.string() }))
	.handler(async ({ data }): Promise<DecidedApproval | null> => {
		const approval = await userAgent().getApproval(data.callId);
		if (!approval || approval.decision === null || approval.decidedAt === null) return null;
		return {
			id: approval.callId,
			chatId: approval.sessionId,
			question: approval.question,
			detail: approval.detail ?? undefined,
			options: approval.options,
			code: approval.code ?? undefined,
			decision: approval.decision,
			createdAt: approval.createdAt,
			decidedAt: approval.decidedAt,
		};
	});

export const decideApproval = createServerFn({ method: "POST" })
	.validator(z.object({ callId: z.string(), answer: z.string() }))
	.handler(({ data }): Promise<void> => userAgent().decideApproval(data.callId, data.answer));

export const getAyoConnection = createServerFn().handler((): Promise<boolean> => userAgent().isAyoConnected());

/** The URL of Ayo's login page, or null when the stored token still connects. */
export const connectAyo = createServerFn({ method: "POST" }).handler(
	(): Promise<string | null> => userAgent().connectAyo(new URL(getRequest().url).origin),
);

/** What happened in the last 7 days, newest first, and every question that still waits. */
export const getToday = createServerFn().handler((): Promise<TodayEvent[]> => userAgent().listToday());

export const getMemories = createServerFn().handler((): Promise<MemoryEntry[]> => userAgent().listMemories());

export const MAIL_TENANTS = ["personal", "getu"] as const;
export type MailTenant = (typeof MAIL_TENANTS)[number];
export const MAIL_TENANT_NAMES: Record<MailTenant, string> = { personal: "Personal", getu: "GeTu" };

export const MAIL_SECURITIES = ["tls", "starttls"] as const;

export type Mailbox = {
	readonly tenant: MailTenant;
	readonly address: string;
	readonly label: string | null;
	readonly senderName: string | null;
};

/** The mail server that did not accept the login. "refused": it said no; "failed": it gave no such answer. */
export type FailedMailLogin = {
	readonly status: "refused" | "failed";
	readonly server: "imap" | "smtp";
	/** The server's text, or the error's. */
	readonly message: string;
};

/** `warning` is set when the mailbox is stored but its polling or its history did not start; mycloud's admin tool repairs that. */
export type AddMailboxResult =
	| { readonly status: "added"; readonly accountId: string | null; readonly warning?: string }
	| FailedMailLogin;

// mycloud throws these after it stored the account (accounts.ts, addAccount). The text is the only signal it gives.
const STORED_BUT_INCOMPLETE = /^The account of .* is (stored|added)/;

const mailServerLogin = z.object({
	host: z.string().trim().min(1),
	port: z.number().int().min(1).max(65535),
	security: z.enum(MAIL_SECURITIES),
	user: z.string().trim().min(1),
	password: z.string().min(1),
});

// The part of mycloud's MailAdmin that the app calls. The generated binding type does not know the class.
interface MailAdminCalls {
	addAccount(
		account: { address: string; imap: z.infer<typeof mailServerLogin>; smtp: z.infer<typeof mailServerLogin> },
		options?: { label?: string; senderName?: string; backfill?: { since: string } },
	): Promise<AddMailboxResult>;
	listAccounts(): Promise<{ address: string; label: string | null; senderName: string | null }[]>;
}

function mailAdmin(tenant: MailTenant) {
	return (tenant === "getu" ? env.MAIL_ADMIN_GETU : env.MAIL_ADMIN) as unknown as MailAdminCalls;
}

/** The mailboxes of both mail systems. `unreadTenants` names a system that did not answer; its mailboxes are missing. */
export const getMailboxes = createServerFn().handler(
	async (): Promise<{ mailboxes: Mailbox[]; unreadTenants: MailTenant[] }> => {
		const unreadTenants: MailTenant[] = [];
		const mailboxesOfTenants = await Promise.all(
			MAIL_TENANTS.map(async (tenant): Promise<Mailbox[]> => {
				try {
					const accounts = await mailAdmin(tenant).listAccounts();
					return accounts
						.map(({ address, label, senderName }) => ({ tenant, address, label, senderName }))
						.sort((a, b) => a.address.localeCompare(b.address));
				} catch (error) {
					console.error(`Cannot read the mailboxes of ${tenant}`, error);
					unreadTenants.push(tenant);
					return [];
				}
			}),
		);
		return { mailboxes: mailboxesOfTenants.flat(), unreadTenants };
	},
);

/**
 * Adds a mailbox to a mail system, which checks both logins first. A login that the server did not
 * accept comes back as a result and stores nothing. The passwords go to the binding only.
 */
export const addMailbox = createServerFn({ method: "POST" })
	.validator(
		z.object({
			tenant: z.enum(MAIL_TENANTS),
			address: z.email().toLowerCase(),
			label: z.string().trim().optional(),
			senderName: z.string().trim().optional(),
			imap: mailServerLogin,
			smtp: mailServerLogin,
			/** How much history to fetch: none, all of it, or the mail from a day on. */
			backfill: z.union([z.enum(["none", "all"]), z.iso.date()]),
		}),
	)
	.handler(async ({ data: { tenant, label, senderName, backfill, ...account } }): Promise<AddMailboxResult> => {
		try {
			return await mailAdmin(tenant).addAccount(account, {
				label: label || undefined,
				senderName: senderName || undefined,
				backfill: backfill === "none" ? undefined : { since: backfill },
			});
		} catch (error) {
			// Only the message, never the input or the error object: the input holds the passwords, and an
			// error's cause can carry what the mail Worker saw.
			console.error(`Cannot add the mailbox ${account.address} to ${tenant}: ${error instanceof Error ? error.message : String(error)}`);
			if (error instanceof Error && STORED_BUT_INCOMPLETE.test(error.message)) {
				return { status: "added", accountId: null, warning: error.message };
			}
			throw error;
		}
	});
