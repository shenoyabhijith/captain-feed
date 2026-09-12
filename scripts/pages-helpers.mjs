
import { copyFileSync, writeFileSync } from "node:fs";
copyFileSync("docs/index.html", "docs/404.html");
writeFileSync("docs/.nojekyll", "");
console.log("pages helpers written");
