/**
 * Private, server-only storage for FundLenz blog form responses.
 * This module writes directly to the site owner's Google Drive.
 * Nothing written here goes to GitHub, site assets or browser code.
 *
 * Scopes: https://www.googleapis.com/auth/drive.file
 */
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type GoogleFile = { id?: string; name?: string };
type GoogleFileList = { files?: GoogleFile[] };

export class PrivateDriveError extends Error {
  constructor(message = "Private storage is unavailable.") { super(message); this.name = "PrivateDriveError"; }
}

function secret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PrivateDriveError();
  return value;
}

async function accessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: secret("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: secret("GOOGLE_OAUTH_CLIENT_SECRET"),
      refresh_token: secret("GOOGLE_OAUTH_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new PrivateDriveError();
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new PrivateDriveError();
  return data.access_token;
}

async function driveJSON<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new PrivateDriveError();
  return await response.json() as T;
}

function quoteQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findChild(token: string, parent: string, name: string, mime?: string): Promise<GoogleFile | undefined> {
  const conditions = [
    "'" + quoteQuery(parent) + "' in parents",
    "name = '" + quoteQuery(name) + "'",
    "trashed = false",
  ];
  if (mime) conditions.push("mimeType = '" + quoteQuery(mime) + "'");
  const url = DRIVE_API + "?fields=files(id,name),nextPageToken&page_size=100&q=" + encodeURIComponent(conditions.join(" and "));
  const found = await driveJSON<GoogleFileList>(token, url);
  return found.files?.find(file => Boolean(file.id));
}

async function createFolder(token: string, parent: string, name: string): Promise<string> {
  const folder = await driveJSON<GoogleFile>(token, DRIVE_API + "?fields=id", {
    method: "POST",
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  });
  if (!folder.id) throw new PrivateDriveError();
  return folder.id;
}

async function getFolder(token: string, parent: string, name: string): Promise<string> {
  const existing = await findChild(token, parent, name, FOLDER_MIME);
  return existing?.id ?? await createFolder(token, parent, name);
}

async function uploadFile(
  token: string, parent: string, name: string, contents: Blob, mime: string,
): Promise<string> {
  const boundary = "fundlenz_" + crypto.randomUUID().replace(/-/g, "");
  const body = new Blob([
    "--" + boundary + "\r\n",
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify({ name, parents: [parent] }),
    "\r\n--" + boundary + "\r\n",
    "Content-Type: " + mime + "\r\n\r\n",
    contents,
    "\r\n--" + boundary + "--\r\n",
  ], { type: "multipart/related; boundary=" + boundary });
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "multipart/related; boundary=" + boundary,
    }, body, cache: "no-store" },
  );
  if (!response.ok) throw new PrivateDriveError();
  const file = await response.json() as GoogleFile;
  if (!file.id) throw new PrivateDriveError();
  return file.id;
}

function asText(value: unknown): Blob {
  return new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
}

async function root(token: string): Promise<string> {
  // Only files made by this OAuth application are visible with drive.file.
  return getFolder(token, "root", "FundLenz Private");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}

export async function saveSubscriber(email: string): Promise<"saved" | "already-subscribed"> {
  const token = await accessToken();
  const folder = await getFolder(token, await root(token), "NEWSLETTERS");
  const filename = (await sha256(email.toLowerCase())) + ".json";
  if (await findChild(token, folder, filename)) return "already-subscribed";
  await uploadFile(token, folder, filename, asText({
    email: email.toLowerCase(), acceptedAt: new Date().toISOString(),
    purpose: "FundLenz email collection", mailingEnabled: false,
  }), "application/json");
  return "saved";
}

export type Contribution = {
  name: string; email: string; title?: string; social?: string;
  document: File; documentType: string;
};

export async function saveContribution(input: Contribution): Promise<string> {
  const token = await accessToken();
  const directory = await getFolder(token, await root(token), "Contributions");
  const id = crypto.randomUUID();
  const label = input.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 40) || "Contributor";
  const folderName = new Date().toISOString().slice(0, 10) + "_" + label + "_" + id;
  const folder = await createFolder(token, directory, folderName);
  // Both writes must succeed before the caller gets a success response.
  await uploadFile(token, folder, "details.json", asText({
    submissionId: id, name: input.name, email: input.email, title: input.title || "",
    social: input.social || "", receivedAt: new Date().toISOString(), status: "pending-review",
  }), "application/json");
  const originalName = input.document.name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-120);
  await uploadFile(token, folder, originalName, input.document, input.documentType);
  return id;
}
