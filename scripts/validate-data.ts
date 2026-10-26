// CI step "Validate the planning data": runs the same boot validator the server runs over
// data/*.yaml, then fails if the committed ids.ts is not what generate-ids would write now,
// because a stale enum would let a token name a task the data no longer has (D31).

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { IDS_PATH, loadValidatedData, renderIds } from './generate-ids';

function readCommitted(): string | null {
  try {
    // A checkout with CRLF line endings holds the same file; compare content, not line endings.
    return readFileSync(IDS_PATH, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const documents = loadValidatedData();
  const expected = await renderIds(documents);
  const committed = readCommitted();
  const where = relative(process.cwd(), IDS_PATH);
  if (committed !== expected) {
    console.error(
      committed === null
        ? `${where} is missing. Run \`npm run generate:ids\` and commit it.`
        : `${where} is out of date with data/*.yaml. Run \`npm run generate:ids\` and commit it.`,
    );
    process.exit(1);
  }
  const rows = documents.tasks.tasks.length + documents.levers.levers.length;
  console.log(
    `Planning data is valid (${String(rows)} tasks and levers, ${String(documents.vendorQuestions.questions.length)} questions) and ${where} is current.`,
  );
}

main().catch((error: unknown) => {
  // A DataFileError message already names the file and the row.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
