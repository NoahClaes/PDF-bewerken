// Zet het pictogram en de versie-informatie in PDF Bewerken.exe (zonder Wine)
import fs from 'fs';
import * as ResEdit from 'resedit';
import png2icons from 'png2icons';

const exe = process.argv[2], png = process.argv[3], icoOut = process.argv[4];
const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version;

const ico = png2icons.createICO(fs.readFileSync(png), png2icons.BICUBIC2, 0, false, true);
fs.writeFileSync(icoOut, ico);

const data = fs.readFileSync(exe);
const pe = ResEdit.NtExecutable.from(data, { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(pe);
const iconFile = ResEdit.Data.IconFile.from(ico);
// vervang het bestaande hoofdpictogram (Electron gebruikt groep-id 1)
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, iconFile.icons.map(i => i.data));

const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
const [a, b, c] = version.split('.').map(Number);
vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
const strings = { FileDescription: 'PDF Bewerken', ProductName: 'PDF Bewerken', CompanyName: 'PDF Bewerken', InternalName: 'PDF Bewerken', OriginalFilename: 'PDF Bewerken.exe', LegalCopyright: 'PDF Bewerken', FileVersion: version, ProductVersion: version };
const langs = vi.getAllLanguagesForStringValues();
for (const l of (langs.length ? langs : [{ lang: 1033, codepage: 1200 }])) vi.setStringValues(l, strings);
vi.outputToResourceEntries(res.entries);
res.outputResource(pe);
fs.writeFileSync(exe, Buffer.from(pe.generate()));
console.log('pictogram en versie gezet in', exe);
