import fs from 'fs';
import path from 'path';

const srcDir = './src';

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

walk(srcDir, (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        // relative paths for services
        content = content.replace(/['"](.*?)\/services\/build-haven\.service['"]/g, "'$1/features/build-haven/api/build-haven.service'");
        content = content.replace(/['"](.*?)\/services\/apprenticeship\.service['"]/g, "'$1/features/apprenticeship/api/apprenticeship.service'");
        content = content.replace(/['"](.*?)\/services\/auth\.service['"]/g, "'$1/features/auth/api/auth.service'");

        // absolute aliases
        content = content.replace(/@\/components\/build-haven/g, '@/features/build-haven/components');
        content = content.replace(/@\/components\/jobs/g, '@/features/apprenticeship/components');
        content = content.replace(/@\/components\/chapter/g, '@/features/learning/components');
        content = content.replace(/@\/services\/build-haven\.service/g, '@/features/build-haven/api/build-haven.service');
        content = content.replace(/@\/services\/apprenticeship\.service/g, '@/features/apprenticeship/api/apprenticeship.service');
        content = content.replace(/@\/services\/auth\.service/g, '@/features/auth/api/auth.service');

        // relative paths for components
        content = content.replace(/(\.\.|\.)\/components\/build-haven/g, '$1/features/build-haven/components');
        content = content.replace(/(\.\.|\.)\/components\/jobs/g, '$1/features/apprenticeship/components');
        content = content.replace(/(\.\.|\.)\/components\/chapter/g, '$1/features/learning/components');

        if (content !== original) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${filePath}`);
        }
    }
});
