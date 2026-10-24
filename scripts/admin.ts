import "../src/server/load-env";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/server/db/client";
import { adminUsers } from "../src/server/db/schema";
import { createAdmin, revokeSessions, setPasswordDirectly } from "../src/server/services/admin-auth";

/**
 * Administrator setup and recovery from the command line.
 *
 *   npm run admin:create            create the single master administrator
 *   npm run admin:reset-password    set a new password (signs out every session)
 *   npm run admin:revoke-sessions   sign out every session
 *
 * The password is read from ADMIN_PASSWORD if set (for automation), otherwise
 * prompted for. It is never printed or written to a file.
 */

async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (hidden) {
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) out.output.write(s);
      else out.output.write("*");
    };
  }
  const answer = await rl.question(question);
  rl.close();
  if (hidden) stdout.write("\n");
  return answer.trim();
}

async function password(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const first = await ask("New password (12+ characters): ", true);
  const second = await ask("Repeat password: ", true);
  if (first !== second) throw new Error("The passwords do not match.");
  return first;
}

async function main() {
  const cmd = process.argv[2];
  const db = getDb();
  if (cmd === "create") {
    const email = process.env.ADMIN_EMAIL || (await ask("Administrator email: "));
    const name = process.env.ADMIN_NAME || (await ask("Name: ")) || "Owner";
    const admin = await createAdmin(db, { email, name, password: await password() }, "cli");
    console.log(`Administrator created for ${admin.email}. Sign in at /admin/login.`);
  } else if (cmd === "reset-password") {
    const email = process.env.ADMIN_EMAIL || (await ask("Administrator email: "));
    await setPasswordDirectly(db, email, await password());
    console.log("Password updated. All sessions were signed out.");
  } else if (cmd === "revoke-sessions") {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.singleton, true));
    if (!admin) throw new Error("No administrator exists yet.");
    const n = await revokeSessions(db, admin.id);
    console.log(`Signed out ${n} session(s).`);
  } else {
    console.log("Usage: tsx scripts/admin.ts create | reset-password | revoke-sessions");
    process.exitCode = 1;
  }
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await closeDb();
    process.exit(1);
  });
