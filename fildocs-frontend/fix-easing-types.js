import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetDir = 'c:/Users/Lorongxz/Computer Science Files/FilDOCS/fildocs-frontend/src';

walk(targetDir, (filePath) => {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content.replace(/ease: (\[[0-9., ]+\])(?! as const)/g, 'ease: $1 as const');
    if (content !== newContent) {
      console.log(`Updating ${filePath}`);
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  }
});
