
import { writeFile, lstat, mkdir } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import type { Tool } from "../types.js";

const WORKSPACE_ROOT = process.cwd();

export const writeTool: Tool = {
  name: "write",
  description:
    "Create a new file or overwrite an existing file inside the workspace. Overwriting requires explicit overwrite: true.",

  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to the workspace root",
      },
      content: {
        type: "string",
        description: "Complete content to write to the file",
      },
      overwrite: {
        type: "boolean",
        description:
          "Must be true to overwrite an existing file. Defaults to false.",
      },
      createDirectories: {
        type: "boolean",
        description:
          "Create missing parent directories. Defaults to false.",
      },
    },
    required: ["path", "content"],
  },

  async execute(args): Promise<string> {
    if (
      typeof args.path !== "string" ||
      args.path.trim() === "" ||
      typeof args.content !== "string"
    ) {
      return "Error: 'path' must be a non-empty string and 'content' must be a string.";
    }

    if (
      (args.overwrite !== undefined &&
        typeof args.overwrite !== "boolean") ||
      (args.createDirectories !== undefined &&
        typeof args.createDirectories !== "boolean")
    ) {
      return "Error: 'overwrite' and 'createDirectories' must be booleans.";
    }

    const workspaceRoot = resolve(WORKSPACE_ROOT);
    const targetPath = resolve(workspaceRoot, args.path);
    const relativePath = relative(workspaceRoot, targetPath);

    if (
      isAbsolute(relativePath) ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`)
    ) {
      return "Error: Path is outside the workspace.";
    }

    if (targetPath === workspaceRoot) {
      return "Error: The path must point to a file, not the workspace root.";
    }

    const overwrite = args.overwrite === true;
    const createDirectories = args.createDirectories === true;

    try {
      // Check every existing path component for symbolic links.
      let currentPath = workspaceRoot;

      for (const part of relativePath.split(sep).slice(0, -1)) {
        currentPath = resolve(currentPath, part);

        try {
          const info = await lstat(currentPath);

          if (info.isSymbolicLink()) {
            return "Error: Writing through symbolic links is not allowed.";
          }

          if (!info.isDirectory()) {
            return `Error: Parent path is not a directory: ${currentPath}`;
          }
        } catch (error) {
          if (
            !(error instanceof Error && "code" in error &&
              error.code === "ENOENT")
          ) {
            throw error;
          }

          if (!createDirectories) {
            return `Error: Parent directory does not exist: ${currentPath}`;
          }

          await mkdir(currentPath);
        }
      }

      // Check the destination without following symbolic links.
      let existingFile = false;

      try {
        const info = await lstat(targetPath);

        if (info.isSymbolicLink()) {
          return "Error: Writing through symbolic links is not allowed.";
        }

        if (!info.isFile()) {
          return "Error: The destination exists but is not a regular file.";
        }

        existingFile = true;
      } catch (error) {
        if (
          !(error instanceof Error && "code" in error &&
            error.code === "ENOENT")
        ) {
          throw error;
        }
      }

      if (existingFile && !overwrite) {
        return "Error: File already exists. Set overwrite: true to replace it.";
      }

      // "wx" prevents accidentally creating over an existing file.
      // "w" is used only after explicit overwrite permission.
      await writeFile(targetPath, args.content, {
        encoding: "utf8",
        flag: overwrite ? "w" : "wx",
      });

      return existingFile
        ? `Successfully overwrote file: ${relativePath}`
        : `Successfully created file: ${relativePath}`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      return `Error writing file: ${message}`;
    }
  },
};