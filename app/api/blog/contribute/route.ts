import { saveContribution } from "@/lib/blog-private-drive";
import {
  allowedEmail, boundedText, privateError, privateJSON, SubmissionError, validateHuman,
} from "@/lib/blog-private-form-security";

const MAX_FILE = 5 * 1024 * 1024;
const MAX_BODY = MAX_FILE + 128 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function isAllowedFile(file: File, extension: string, bytes: Uint8Array): boolean {
  if (!TYPES[extension] || file.size < 8 || file.size > MAX_FILE) return false;
  if (extension === "pdf")
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  if (extension === "docx")
    return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value);
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (length > MAX_BODY) throw new SubmissionError(413, "File exceeds the 5 MB limit.");
    if (!(request.headers.get("content-type") || "").includes("multipart/form-data"))
      throw new SubmissionError(415, "Expected a file upload.");
    const form = await request.formData();
    const name = boundedText(form.get("name"), 120, true);
    const email = allowedEmail(form.get("email"));
    const title = boundedText(form.get("title"), 240, false);
    const social = boundedText(form.get("social"), 500, false);
    const file = form.get("document");
    if (!(file instanceof File) || file.size > MAX_FILE) throw new SubmissionError(400, "Upload a PDF, DOC, or DOCX under 5 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (!isAllowedFile(file, ext, header))
      throw new SubmissionError(400, "Upload a valid PDF, DOC, or DOCX under 5 MB.");
    await validateHuman(request, form.get("turnstileToken"));
    const id = await saveContribution({
      name, email, title, social, document: file, documentType: TYPES[ext],
    });
    return privateJSON({ ok: true, submissionId: id }, 201);
  } catch (error) { return privateError(error); }
}
