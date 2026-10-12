import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export class WorkspaceBoundaryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "WorkspaceBoundaryError";
    }
}

/**
 * True when `target` is `root` itself or somewhere beneath it.
 * Both arguments must already be absolute, normalized paths.
 * Uses path.relative instead of a string-prefix check, so "/ws-evil"
 * is not mistaken for being inside "/ws", while a file literally
 * named "..foo" is still treated as inside.
 */
function isInside(root: string, target: string): boolean {
    const rel = relative(root, target);
    if (rel === "") return true;
    if (isAbsolute(rel)) return false; // different drive on Windows
    return rel !== ".." && !rel.startsWith(".." + sep);
}

/**
 * Resolves `userPath` against `workspaceRoot` and returns a verified absolute
 * path that is guaranteed to be inside the workspace at the time of the check.
 *
 * - Relative and absolute inputs are both accepted, then verified.
 * - `..` segments are collapsed before the check.
 * - Symlinks are followed (realpath), so a link inside the workspace that
 *   points outside is rejected.
 * - A path that does not exist yet (e.g. a file about to be created) is
 *   verified through its nearest existing ancestor directory.
 * - A dangling symlink is rejected, because writing through it could create
 *   a file outside the workspace.
 *
 * Throws WorkspaceBoundaryError when the path is invalid or outside.
 *
 * Limitation: this is a check-then-use guard. A symlink swapped in after this
 * function returns is not detected (TOCTOU). Not tested on Windows.
 */
export async function resolveInsideWorkspace(
    workspaceRoot: string,
    userPath: string
): Promise<string> {
    if (typeof userPath !== "string" || userPath.trim() === "") {
        throw new WorkspaceBoundaryError("Path must be a non-empty string.");
    }
    if (userPath.includes("\0")) {
        throw new WorkspaceBoundaryError("Path contains an invalid null byte.");
    }

    const rootReal = await realpath(resolve(workspaceRoot));
    const candidate = resolve(rootReal, userPath);

    // Cheap lexical rejection of "../" escapes and outside absolute paths.
    if (!isInside(rootReal, candidate)) {
        throw new WorkspaceBoundaryError(
            `Path is outside the workspace: ${userPath}`
        );
    }

    // Walk up to the nearest existing ancestor, resolving symlinks there.
    let existing = candidate;
    const missingParts: string[] = [];

    for (;;) {
        try {
            const real = await realpath(existing);
            const finalPath = join(real, ...missingParts.reverse());
            if (!isInside(rootReal, finalPath)) {
                throw new WorkspaceBoundaryError(
                    `Path is outside the workspace: ${userPath}`
                );
            }
            return finalPath;
        } catch (error) {
            if (error instanceof WorkspaceBoundaryError) throw error;

            const code = (error as NodeJS.ErrnoException).code;
            if (code !== "ENOENT" && code !== "ENOTDIR") throw error;

            // realpath fails for a dangling symlink too; lstat tells them apart.
            try {
                await lstat(existing);
                throw new WorkspaceBoundaryError(
                    `Path is a broken symlink and cannot be verified: ${userPath}`
                );
            } catch (lstatError) {
                if (lstatError instanceof WorkspaceBoundaryError) throw lstatError;
                // Genuinely missing: keep walking up.
            }

            const parent = dirname(existing);
            if (parent === existing) {
                throw new WorkspaceBoundaryError(
                    `Path is outside the workspace: ${userPath}`
                );
            }
            missingParts.push(existing.slice(parent.length).replace(/^[\\/]+/, ""));
            existing = parent;
        }
    }
}

/*
Step report: workspace path-boundary helper

Problem: read, ls and edit accept any path, including ../ and absolute paths, so the model can touch files outside the project. There was no shared rule to enforce a boundary.

File added: src/tools/pathBoundary.ts (attached as pathBoundary.ts). No existing file was modified, and the helper isn’t called by any tool yet, so runtime behavior is unchanged.

What it provides:

resolveInsideWorkspace(workspaceRoot, userPath) returns a verified absolute path or throws WorkspaceBoundaryError.
It collapses .. first, then compares with path.relative. This is not a string-prefix check, so /ws-evil is correctly seen as outside /ws, while a file named ..foo inside the workspace is allowed.
It resolves symlinks with realpath and rejects links that point outside.
For a file that doesn’t exist yet, it verifies the nearest existing ancestor directory, so file creation will work later.
It rejects dangling symlinks (they could be used to create files outside), empty or non-string paths, and null bytes.

Checks run and results:

tsc --noEmit: passed, exit 0.
A throwaway script (/tmp/edittest/boundary.mts, not in the repo) built a temp workspace with a sibling ws-evil directory and several symlinks. 23 of 23 cases passed: 10 allowed (relative, ., sub/../a.txt, absolute inside, ..foo, new file in existing and new directories, inside-to-inside symlink, workspace root reached through a symlink, path under a file) and 13 blocked (the .. escapes, absolute paths outside, the prefix trick, three symlink escapes, the dangling link, null byte, empty string, non-string).
Not run: Windows (drive letters, case-insensitive paths, backslashes) and macOS; I only ran Linux. I also haven’t tested it inside any tool.

Known limitations:

It’s a check-then-use guard. If a symlink is swapped in after the check, it isn’t caught (a TOCTOU gap). Closing that would need a sandbox, not just a path check.
A new file’s parent directories are checked, but nothing creates them. That’s a decision for the future write tool.
The workspace root is a parameter. Deciding where it comes from (launch directory, --workspace flag, or config) is still open. I’d use the launch process.cwd() for now unless you say otherwise.
The earlier items remain: the PATH debug print, the approval prompt hiding the command, the .gitignore conflict markers, and no search or write too
*/