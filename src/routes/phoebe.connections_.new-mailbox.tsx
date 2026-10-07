import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { type ReactNode, type SubmitEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
	addMailbox,
	type FailedMailLogin,
	MAIL_SECURITIES,
	MAIL_TENANT_NAMES,
	MAIL_TENANTS,
	type MailTenant,
} from "@/workspace-data";

export const Route = createFileRoute("/phoebe/connections_/new-mailbox")({
	staticData: { section: "New mailbox" },
	component: NewMailboxPage,
});

const labelClass = "text-[13px] text-ink-soft";

// The radio input is hidden; its mark takes the ring when the input is checked or has the keyboard focus.
const choiceMarkClass =
	"inline-flex h-8 cursor-pointer items-center rounded-full border border-line-strong px-3.5 text-ink-soft outline-offset-2 touch:h-11 " +
	"peer-checked:border-ink peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-primary";

const textLinkClass = "cursor-pointer rounded-sm text-[13px] text-ink-soft underline underline-offset-2 hover:text-ink";

const SERVERS = ["imap", "smtp"] as const;
type Server = (typeof SERVERS)[number];
type Security = (typeof MAIL_SECURITIES)[number];

/** How to reach one mail server. `user` is undefined until it is edited: it is the address until then. */
type ServerFields = { host: string; port: string; security: Security; user?: string };

const SERVER_NAMES: Record<Server, string> = { imap: "IMAP", smtp: "SMTP" };

// Migadu, which hosts every mailbox so far.
const MIGADU_SERVERS: Record<Server, ServerFields> = {
	imap: { host: "imap.migadu.com", port: "993", security: "tls" },
	smtp: { host: "smtp.migadu.com", port: "465", security: "tls" },
};

const HISTORY_CHOICES = [
	{ value: "none", label: "New mail only" },
	{ value: "all", label: "Everything" },
	{ value: "since", label: "Since a date" },
] as const;
type History = (typeof HISTORY_CHOICES)[number]["value"];

function Choices<Value extends string>({
	legend,
	name,
	choices,
	value,
	onChange,
	children,
}: {
	legend: string;
	name: string;
	choices: readonly { value: Value; label: string }[];
	value: Value;
	onChange: (value: Value) => void;
	children?: ReactNode;
}) {
	return (
		<fieldset className="grid gap-1.5">
			<legend className={cn(labelClass, "mb-1.5")}>{legend}</legend>
			<div className="flex flex-wrap gap-2">
				{choices.map((choice) => (
					<label key={choice.value}>
						<input
							type="radio"
							name={name}
							checked={choice.value === value}
							onChange={() => onChange(choice.value)}
							className="peer sr-only"
						/>
						<span className={choiceMarkClass}>{choice.label}</span>
					</label>
				))}
			</div>
			{children}
		</fieldset>
	);
}

/**
 * A mailbox for one of the mail systems, with the input of mycloud's admin tool. The mail system checks
 * both logins before it stores anything, so a refused login keeps the form as it is.
 */
function NewMailboxPage() {
	const router = useRouter();
	const navigate = useNavigate();
	const [tenant, setTenant] = useState<MailTenant>("personal");
	const [address, setAddress] = useState("");
	const [servers, setServers] = useState(MIGADU_SERVERS);
	const [areServersOpen, setAreServersOpen] = useState(false);
	const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
	const [history, setHistory] = useState<History>("none");
	const [isAdding, setIsAdding] = useState(false);
	const [failedLogin, setFailedLogin] = useState<FailedMailLogin>();

	function setServerField(server: Server, fields: Partial<ServerFields>) {
		setServers((previous) => ({ ...previous, [server]: { ...previous[server], ...fields } }));
	}

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isAdding) return;
		const form = event.currentTarget;
		const fields = new FormData(form);
		const imapPassword = String(fields.get("password"));
		const passwords: Record<Server, string> = {
			imap: imapPassword,
			smtp: hasSmtpPassword ? String(fields.get("smtp-password")) : imapPassword,
		};
		const login = (server: Server) => ({
			host: servers[server].host,
			port: Number(servers[server].port),
			security: servers[server].security,
			user: servers[server].user ?? address,
			password: passwords[server],
		});
		setIsAdding(true);
		setFailedLogin(undefined);
		try {
			const result = await addMailbox({
				data: {
					tenant,
					address: address.trim(),
					label: String(fields.get("label")),
					senderName: String(fields.get("sender-name")),
					imap: login("imap"),
					smtp: login("smtp"),
					backfill: history === "since" ? String(fields.get("since")) : history,
				},
			});
			if (result.status !== "added") {
				setFailedLogin(result);
				return;
			}
			// The password must not stay in the page after the mailbox has it.
			form.reset();
			if (result.warning === undefined) toast.add({ title: "Mailbox added" });
			else toast.add({ title: "Mailbox added, but not complete", description: result.warning });
		} catch (error) {
			// Only the message: the error of a server function can carry the input, and so the password.
			const message = error instanceof Error ? error.message : String(error);
			console.error("Cannot add the mailbox:", message);
			// A refused input comes back as a printed list of issues, which is no text for a toast.
			toast.add({
				title: "Could not add the mailbox",
				description: message.startsWith("[") ? "Check the address and the date." : message,
			});
			return;
		} finally {
			setIsAdding(false);
		}
		await router.invalidate();
		await navigate({ to: "/phoebe/connections", search: true });
	}

	const serversSummary = SERVERS.map(
		(server) => `${servers[server].host} ${servers[server].port} ${servers[server].security}`,
	).join(" · ");

	return (
		<form onSubmit={handleSubmit} className="grid gap-6">
			<Choices
				legend="Mail system"
				name="tenant"
				choices={MAIL_TENANTS.map((value) => ({ value, label: MAIL_TENANT_NAMES[value] }))}
				value={tenant}
				onChange={setTenant}
			>
				<p className="mt-1.5 text-[13px] text-ink-soft">Which mail system the mailbox joins.</p>
			</Choices>
			<div className="grid gap-1.5">
				<label htmlFor="mailbox-address" className={labelClass}>
					Address
				</label>
				<Input
					id="mailbox-address"
					type="email"
					value={address}
					onChange={(event) => setAddress(event.target.value)}
					required
					placeholder="you@example.org"
					autoComplete="off"
				/>
			</div>
			<div className="grid gap-1.5">
				<label htmlFor="mailbox-label" className={labelClass}>
					Label
				</label>
				<p className="text-[13px] text-ink-soft">What the mailbox is called in lists, for example billing</p>
				<Input id="mailbox-label" name="label" autoComplete="off" />
			</div>
			<div className="grid gap-1.5">
				<label htmlFor="mailbox-sender-name" className={labelClass}>
					Sender name
				</label>
				<p className="text-[13px] text-ink-soft">The name in the From header</p>
				<Input id="mailbox-sender-name" name="sender-name" autoComplete="off" />
			</div>
			<div className="grid gap-1.5">
				<label htmlFor="mailbox-password" className={labelClass}>
					{hasSmtpPassword ? "IMAP password" : "Password"}
				</label>
				<Input id="mailbox-password" name="password" type="password" required autoComplete="new-password" />
				{hasSmtpPassword && (
					<>
						<label htmlFor="mailbox-smtp-password" className={cn(labelClass, "mt-3")}>
							SMTP password
						</label>
						<Input id="mailbox-smtp-password" name="smtp-password" type="password" required autoComplete="new-password" />
					</>
				)}
				<button
					type="button"
					onClick={() => setHasSmtpPassword(!hasSmtpPassword)}
					className={cn(textLinkClass, "justify-self-start max-wide:min-h-11 touch:min-h-11")}
				>
					{hasSmtpPassword ? "One password" : "Different passwords"}
				</button>
			</div>
			<div className="grid gap-4">
				<button
					type="button"
					aria-expanded={areServersOpen}
					aria-controls="mailbox-servers"
					onClick={() => setAreServersOpen(!areServersOpen)}
					className="flex cursor-pointer flex-wrap items-baseline gap-x-2.5 rounded-sm text-left max-wide:min-h-11 max-wide:items-center touch:min-h-11 touch:items-center"
				>
					<span className={textLinkClass}>Servers</span>
					<span className="text-[13px] text-ink-soft">{serversSummary}</span>
				</button>
				{/* The fields stay in the page while closed, so a field that fails the browser's check opens them. */}
				<div
					id="mailbox-servers"
					hidden={!areServersOpen}
					onInvalid={() => setAreServersOpen(true)}
					className="grid gap-6"
				>
					{SERVERS.map((server) => (
						<fieldset key={server} className="grid gap-3">
							<legend className={cn(labelClass, "mb-3")}>{SERVER_NAMES[server]}</legend>
							<div className="flex gap-2">
								<div className="grid min-w-0 flex-1 gap-1.5">
									<label htmlFor={`mailbox-${server}-host`} className={labelClass}>
										Host
									</label>
									<Input
										id={`mailbox-${server}-host`}
										value={servers[server].host}
										onChange={(event) => setServerField(server, { host: event.target.value })}
										required
										autoComplete="off"
										autoCapitalize="none"
										spellCheck={false}
									/>
								</div>
								<div className="grid w-24 shrink-0 gap-1.5">
									<label htmlFor={`mailbox-${server}-port`} className={labelClass}>
										Port
									</label>
									<Input
										id={`mailbox-${server}-port`}
										type="number"
										min={1}
										max={65535}
										value={servers[server].port}
										onChange={(event) => setServerField(server, { port: event.target.value })}
										required
									/>
								</div>
							</div>
							<Choices
								legend="Security"
								name={`${server}-security`}
								choices={MAIL_SECURITIES.map((value) => ({ value, label: value }))}
								value={servers[server].security}
								onChange={(security) => setServerField(server, { security })}
							/>
							<div className="grid gap-1.5">
								<label htmlFor={`mailbox-${server}-user`} className={labelClass}>
									User
								</label>
								<Input
									id={`mailbox-${server}-user`}
									value={servers[server].user ?? address}
									onChange={(event) => setServerField(server, { user: event.target.value })}
									required
									autoComplete="off"
									autoCapitalize="none"
									spellCheck={false}
								/>
							</div>
						</fieldset>
					))}
				</div>
			</div>
			<Choices legend="History" name="history" choices={HISTORY_CHOICES} value={history} onChange={setHistory}>
				{history === "since" && (
					<Input type="date" name="since" required aria-label="Since" className="mt-1.5 w-auto justify-self-start" />
				)}
			</Choices>
			<div className="grid gap-2 justify-items-start">
				<Button type="submit" variant="primary" disabled={isAdding}>
					{isAdding ? "Checking the logins…" : "Add mailbox"}
				</Button>
				{failedLogin && (
					<p role="alert" className="text-[13px] text-danger [overflow-wrap:anywhere]">
						{failedLogin.status === "refused"
							? `The ${SERVER_NAMES[failedLogin.server]} server refused the login: `
							: `The login at the ${SERVER_NAMES[failedLogin.server]} server failed: `}
						{failedLogin.message}
					</p>
				)}
			</div>
		</form>
	);
}
