#!/usr/bin/env python3
"""Sync editable data workbooks with the CSV files used by the site.

CSV files cannot contain multiple sheets, so the workbook is the human-edited
source and the CSV files remain the browser-friendly runtime data.
"""

from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
UTF8_BOM = "\ufeff"


@dataclass(frozen=True)
class SheetConfig:
    name: str
    csv_path: Path
    expected_header: str
    include_bom: bool = True


@dataclass(frozen=True)
class WorkbookConfig:
    name: str
    workbook_path: Path
    title: str
    sheets: List[SheetConfig]


WORKBOOKS = {
    "open-works": WorkbookConfig(
        name="open-works",
        workbook_path=ROOT / "public/data/open-works.xlsx",
        title="Open Works Data",
        sheets=[
            SheetConfig("open-works", ROOT / "public/data/open-works.csv", "title,summary,slug"),
            SheetConfig(
                "open-work-details",
                ROOT / "public/data/open-work-details.csv",
                "slug,kicker,detail_summary,format,status,role,lede,detail,features,action_label,image_url,image_alt,external_note",
            ),
            SheetConfig("open-works-page", ROOT / "public/data/open-works-page.csv", "title,summary"),
            SheetConfig("open-work-links", ROOT / "public/data/open-work-links.csv", "slug,label,url,sort"),
            SheetConfig("open-work-examples", ROOT / "public/data/open-work-examples.csv", "slug,kicker,title,media_url,media_type,caption,sort"),
            SheetConfig(
                "open-work-manuals",
                ROOT / "public/data/open-work-manuals.csv",
                "slug,section_title,step_title,body,sort",
            ),
        ],
    ),
    "works": WorkbookConfig(
        name="works",
        workbook_path=ROOT / "public/data/works.xlsx",
        title="Works Data",
        sheets=[
            SheetConfig("works", ROOT / "public/data/works.csv", "id,overview,artist,category,year,url,text", False),
            SheetConfig("work-media", ROOT / "public/data/work-media.csv", "work_id,type,url,caption,sort", False),
        ],
    ),
}


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def column_name(index: int) -> str:
    name = ""
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref.upper())
    if not letters:
        return 0
    index = 0
    for char in letters.group(0):
        index = index * 26 + ord(char) - 64
    return index - 1


def escape_xml(value: str) -> str:
    return html.escape(value, quote=True)


def trim_rows(rows: List[List[str]]) -> List[List[str]]:
    trimmed = [list(row) for row in rows]
    while trimmed and not any(cell.strip() for cell in trimmed[-1]):
        trimmed.pop()
    return trimmed


def normalize_rows(rows: List[List[str]], expected_header: str) -> List[List[str]]:
    rows = trim_rows(rows)
    header = expected_header.split(",")
    width = len(header)
    normalized: List[List[str]] = []
    for index, row in enumerate(rows):
        current = [cell if cell is not None else "" for cell in row]
        if index == 0:
            current = header
        if len(current) < width:
            current += [""] * (width - len(current))
        normalized.append(current[:width])
    return normalized


def ensure_expected_header(rows: List[List[str]], expected_header: str, source: Path | str) -> List[List[str]]:
    rows = trim_rows(rows)
    if not rows:
        raise ValueError(f"{source}: missing header row; refusing to export an empty sheet")

    width = len(expected_header.split(","))
    header = [cell if cell is not None else "" for cell in rows[0]]
    if len(header) < width:
        header += [""] * (width - len(header))
    header = header[:width]
    if header:
        header[0] = header[0].removeprefix(UTF8_BOM)

    received_header = ",".join(header)
    if received_header != expected_header:
        raise ValueError(f"{source}: expected header {expected_header!r}, received {received_header!r}")
    return rows


def read_csv_rows(path: Path, expected_header: str) -> List[List[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.reader(file))
    rows = ensure_expected_header(rows, expected_header, path)
    rows = normalize_rows(rows, expected_header)
    return rows


def rows_to_csv_text(rows: List[List[str]], include_bom: bool) -> str:
    from io import StringIO

    buffer = StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerows(rows)
    text = buffer.getvalue().rstrip("\n") + "\n"
    return f"{UTF8_BOM}{text}" if include_bom else text


def column_widths(rows: List[List[str]]) -> List[int]:
    max_col = max((len(row) for row in rows), default=1)
    widths = []
    for col_index in range(max_col):
        longest = max((len(str(row[col_index])) if col_index < len(row) else 0 for row in rows), default=8)
        widths.append(min(max(longest + 2, 12), 58))
    return widths


def worksheet_xml(rows: List[List[str]], widths: List[int]) -> str:
    max_row = max(len(rows), 1)
    max_col = max((len(row) for row in rows), default=1)
    dimension = f"A1:{column_name(max_col - 1)}{max_row}"
    col_xml = "".join(
        f'<col min="{i + 1}" max="{i + 1}" width="{width}" customWidth="1"/>'
        for i, width in enumerate(widths)
    )
    row_xml = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for col_index, value in enumerate(row):
            ref = f"{column_name(col_index)}{row_index}"
            style = "1" if row_index == 1 else "2"
            text = escape_xml(str(value))
            preserve = ' xml:space="preserve"' if text != text.strip() else ""
            cells.append(f'<c r="{ref}" t="inlineStr" s="{style}"><is><t{preserve}>{text}</t></is></c>')
        height = ' ht="24" customHeight="1"' if row_index == 1 else ""
        row_xml.append(f'<row r="{row_index}"{height}>{"".join(cells)}</row>')

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="{NS["main"]}" xmlns:r="{NS["rel"]}">
  <dimension ref="{dimension}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>{col_xml}</cols>
  <sheetData>{"".join(row_xml)}</sheetData>
  <autoFilter ref="{dimension}"/>
</worksheet>'''


def workbook_xml(sheet_names: Iterable[str]) -> str:
    sheet_xml = "".join(
        f'<sheet name="{escape_xml(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, name in enumerate(sheet_names, start=1)
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="{NS["main"]}" xmlns:r="{NS["rel"]}">
  <workbookPr date1904="false"/>
  <sheets>{sheet_xml}</sheets>
</workbook>'''


def workbook_rels(sheet_count: int) -> str:
    sheet_rels = "".join(
        f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, sheet_count + 1)
    )
    style_id = sheet_count + 1
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{NS["pkgrel"]}">
  {sheet_rels}
  <Relationship Id="rId{style_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''


def content_types(sheet_count: int) -> str:
    sheet_overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  {sheet_overrides}
</Types>'''


STYLES_XML = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="{NS["main"]}">
  <fonts count="2">
    <font><sz val="11"/><name val="Aptos"/></font>
    <font><b/><sz val="11"/><name val="Aptos"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEDEBE6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFB8B4AD"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''


ROOT_RELS_XML = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{NS["pkgrel"]}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''


def core_xml(title: str) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>{escape_xml(title)}</dc:title>
  <dc:creator>kyutodaze.com</dc:creator>
</cp:coreProperties>'''


APP_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>kyutodaze.com</Application>
</Properties>'''


def write_workbook(rows_by_sheet: Dict[str, List[List[str]]], output_path: Path, title: str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet_names = list(rows_by_sheet.keys())
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types(len(sheet_names)))
        archive.writestr("_rels/.rels", ROOT_RELS_XML)
        archive.writestr("docProps/core.xml", core_xml(title))
        archive.writestr("docProps/app.xml", APP_XML)
        archive.writestr("xl/workbook.xml", workbook_xml(sheet_names))
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels(len(sheet_names)))
        archive.writestr("xl/styles.xml", STYLES_XML)
        for index, name in enumerate(sheet_names, start=1):
            rows = rows_by_sheet[name]
            archive.writestr(f"xl/worksheets/sheet{index}.xml", worksheet_xml(rows, column_widths(rows)))


def shared_strings(archive: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.findall(".//main:t", NS)) for item in root.findall("main:si", NS)]


def workbook_sheet_targets(archive: zipfile.ZipFile) -> Dict[str, str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"].lstrip("/") for rel in rels.findall("pkgrel:Relationship", NS)}
    sheet_targets: Dict[str, str] = {}
    for sheet in workbook.findall("main:sheets/main:sheet", NS):
        name = sheet.attrib["name"]
        relationship_id = sheet.attrib[f"{{{NS['rel']}}}id"]
        target = targets[relationship_id]
        sheet_targets[name] = target if target.startswith("xl/") else f"xl/{target}"
    return sheet_targets


def cell_text(cell: ET.Element, strings: List[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:is/main:t", NS))
    value = cell.find("main:v", NS)
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        return strings[int(value.text)]
    return value.text


def read_workbook(workbook: WorkbookConfig) -> Dict[str, List[List[str]]]:
    with zipfile.ZipFile(workbook.workbook_path) as archive:
        strings = shared_strings(archive)
        targets = workbook_sheet_targets(archive)
        rows_by_sheet: Dict[str, List[List[str]]] = {}
        for config in workbook.sheets:
            if config.name not in targets:
                raise ValueError(f"{workbook.workbook_path}: missing sheet {config.name!r}")
            root = ET.fromstring(archive.read(targets[config.name]))
            rows: List[List[str]] = []
            for row in root.findall(".//main:sheetData/main:row", NS):
                cells: List[str] = []
                for cell in row.findall("main:c", NS):
                    ref = cell.attrib.get("r", f"A{len(rows) + 1}")
                    index = column_index(ref)
                    while len(cells) <= index:
                        cells.append("")
                    cells[index] = cell_text(cell, strings)
                rows.append(cells)
            rows = ensure_expected_header(rows, config.expected_header, f"{workbook.workbook_path}:{config.name}")
            rows_by_sheet[config.name] = normalize_rows(rows, config.expected_header)
        return rows_by_sheet


def from_csv(workbook: WorkbookConfig) -> None:
    rows_by_sheet = {config.name: read_csv_rows(config.csv_path, config.expected_header) for config in workbook.sheets}
    write_workbook(rows_by_sheet, workbook.workbook_path, workbook.title)
    print(f"Wrote {workbook.workbook_path.relative_to(ROOT)}")


def to_csv(workbook: WorkbookConfig, check_only: bool = False) -> bool:
    rows_by_sheet = read_workbook(workbook)
    ok = True
    for config in workbook.sheets:
        rows = normalize_rows(rows_by_sheet[config.name], config.expected_header)
        next_text = rows_to_csv_text(rows, config.include_bom)
        if check_only:
            current_text = config.csv_path.read_text(encoding="utf-8")
            if current_text != next_text:
                print(f"{config.csv_path.relative_to(ROOT)} is not synced with {workbook.workbook_path.relative_to(ROOT)}")
                ok = False
            continue
        config.csv_path.write_text(next_text, encoding="utf-8")
        print(f"Wrote {config.csv_path.relative_to(ROOT)}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset",
        choices=sorted(WORKBOOKS),
        default="open-works",
        help="Workbook dataset to sync. Defaults to open-works for backwards compatibility.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--from-csv", action="store_true", help="Create/update the workbook from the CSV files.")
    group.add_argument("--to-csv", action="store_true", help="Export the workbook sheets back to CSV files.")
    group.add_argument("--check", action="store_true", help="Check that workbook and CSV files are in sync.")
    args = parser.parse_args()
    workbook = WORKBOOKS[args.dataset]

    if args.from_csv:
        from_csv(workbook)
        return 0
    if args.to_csv:
        to_csv(workbook, check_only=False)
        return 0
    return 0 if to_csv(workbook, check_only=True) else 1


if __name__ == "__main__":
    sys.exit(main())
