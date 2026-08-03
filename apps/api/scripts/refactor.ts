import { Project } from "ts-morph";
import * as path from "path";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const moduleMapping: Record<string, string[]> = {
  auth: ["auth", "auth-phone", "users", "settings"],
  billing: ["payments", "payments.public", "referrals", "subscriptions"],
  learning: [
    "roadmaps",
    "chapters",
    "categories",
    "problems",
    "submissions",
    "certificates",
    "feedback",
    "status",
    "notes",
  ],
  apprenticeship: ["jobs", "tasks", "resume"],
  execution: ["execute", "ai", "javaExecutor"],
  communication: ["whatsapp", "email"],
  admin: ["admin", "admin-chapters"],
};

function getModuleName(basename: string): string {
  for (const [mod, prefixes] of Object.entries(moduleMapping)) {
    for (const prefix of prefixes) {
      if (basename.startsWith(prefix)) {
        return mod;
      }
    }
  }
  return "core"; // default module
}

const foldersToProcess = ["controllers", "services", "routes"];

for (const folder of foldersToProcess) {
  const files = project.getSourceFiles(`src/${folder}/**/*.ts`);
  for (const file of files) {
    const baseName = file.getBaseName();
    const mod = getModuleName(baseName);
    
    // e.g., src/modules/auth/controllers/
    const newDir = project.createDirectory(`src/modules/${mod}/${folder}`);
    file.moveToDirectory(newDir);
  }
}

project.saveSync();
console.log("Refactoring complete.");
