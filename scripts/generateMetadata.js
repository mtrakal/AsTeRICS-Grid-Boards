const fs = require('fs');
const path = require('path');
const BASE_FOLDER = "live"
const startFolder = path.join(__dirname, "..", BASE_FOLDER);
const INFO_FILENAME = "info.json";
const OUTPUT_FILENAME = "live_metadata.json";

let rootFolders = fs.readdirSync(startFolder, {withFileTypes: true}).filter(e => e.isDirectory());
let metadataObjects = [];

for (let rootFolder of rootFolders) {
    metadataObjects = metadataObjects.concat(folderToMetadata(rootFolder));
}
fs.writeFileSync(path.join(__dirname, "..", OUTPUT_FILENAME), JSON.stringify(metadataObjects));
console.log(`Successfully written ${metadataObjects.length} elements to ${OUTPUT_FILENAME}!`)

function folderToMetadata(folder, options = {
    needsInfoFile: true
}) {
    options.baseFolder = options.baseFolder || BASE_FOLDER;
    if (!folder) {
        return null;
    }
    let currentPath = path.join(folder.path, folder.name);
    let folderContents = fs.readdirSync(currentPath, { withFileTypes: true });
    let langCodeFolders = folderContents.filter(e => e.isDirectory() && e.name.length == 2);
    let infoFile = folderContents.find(e => e.name === INFO_FILENAME);
    let grdFiles = folderContents.filter(e => e.name.endsWith(".grd.json") || e.name.endsWith(".grd"));
    if (!infoFile && grdFiles.length > 0 && options.needsInfoFile) {
        console.warn(`no info file found for "${folder.name}"!`);
        return null;
    }
    let infoContent = {};
    if (infoFile) {
        let infoContentString = fs.readFileSync(path.join(infoFile.path, infoFile.name), 'utf-8');
        infoContent = JSON.parse(infoContentString);
    }
    if (grdFiles.length > 1) {
        console.warn(`more than 1 .grd file in "${folder.name}"!`);
        return null;
    }
    if (grdFiles.length === 1) {
        infoContent.path = `${options.baseFolder}/${folder.name}/${grdFiles[0].name}`;
        return [infoContent];
    }
    if (langCodeFolders.length > 0) {
        let returnArray = [];
        for (let langFolder of langCodeFolders) {
            let langCode = langFolder.name.toLocaleLowerCase();
            let subInfos = folderToMetadata(langFolder, {
                baseFolder: `${options.baseFolder}/${folder.name}`,
                needsInfoFile: !infoFile
            });
            let subInfo = subInfos ? subInfos[0] : {};
            subInfo.languages = subInfo.languages || [langCode];
            let infoContentCopy = JSON.parse(JSON.stringify(infoContent));
            Object.assign(infoContentCopy, subInfo);
            if (!isString(infoContentCopy.description)) {
                for (let lang of Object.keys(infoContent.description)) {
                    let langLower = lang.toLocaleLowerCase();
                    if (langLower !== langCode && langLower !== 'en') {
                        delete infoContentCopy.description[lang];
                    }
                }
            }
            returnArray.push(infoContentCopy);
        }
        return returnArray;
    }
}

function isString (value) {
    return typeof value === 'string' || value instanceof String;
};