const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const BASE_FOLDER = "live"
const startFolder = path.join(__dirname, "..", BASE_FOLDER);
const INFO_FILENAME = "info.json";
const OUTPUT_FILENAME = "live_metadata.json";
const THUMBNAIL_FILENAME = "thumbnail";

let rootFolders = fs.readdirSync(startFolder, {withFileTypes: true}).filter(e => e.isDirectory());
let metadataObjects = [];

main();

async function main() {
    for (let rootFolder of rootFolders) {
        let newObjects = await folderToMetadata(rootFolder);
        metadataObjects = metadataObjects.concat(newObjects);
    }
    fs.writeFileSync(path.join(__dirname, "..", OUTPUT_FILENAME), JSON.stringify(metadataObjects));
    console.log(`Successfully written ${metadataObjects.length} elements to ${OUTPUT_FILENAME}!`)
}

async function folderToMetadata(folder, options = {
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
    let imageFiles = folderContents.filter(e => e.name.endsWith(".png") || e.name.endsWith(".jpg") || e.name.endsWith(".jpeg"));
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
    if (imageFiles.length > 0) {
        let suffix = imageFiles[0].name.substring(imageFiles[0].name.lastIndexOf('.'));
        let thumbnailFilename = THUMBNAIL_FILENAME + suffix;
        imageFiles.filter(e => e.name !== thumbnailFilename);
        imageFiles.sort((a, b) => a.name.localeCompare(b.name));
        infoContent.images = imageFiles.map(e => `${options.baseFolder}/${folder.name}/${e.name}`);
        let outputPath = path.join(__dirname, "..", options.baseFolder, folder.name, thumbnailFilename)
        await sharp(path.join(__dirname, '..', infoContent.images[0]))
            .resize(500)
            .toFile(outputPath);
        infoContent.thumbnail = `${options.baseFolder}/${folder.name}/${thumbnailFilename}`;
    }
    if (grdFiles.length === 1) {
        infoContent.path = `${options.baseFolder}/${folder.name}/${grdFiles[0].name}`;
        return [infoContent];
    }
    if (langCodeFolders.length > 0) {
        let returnArray = [];
        for (let langFolder of langCodeFolders) {
            let langCode = langFolder.name.toLocaleLowerCase();
            let subInfos = await folderToMetadata(langFolder, {
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