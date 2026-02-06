
import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function test() {
    const workbook = new ExcelJS.Workbook();
    // Path relative to root
    const filePath = path.join(process.cwd(), 'data1', 'Device Planning Blu.xlsx');
    console.log('Reading:', filePath);
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);
    const headerRow = sheet.getRow(1);

    // Buscar la fila de Blu G65L
    sheet.eachRow((row, rowNumber) => {
        const values = row.values as any[];
        if (values.includes('Blu G65L')) {
            console.log(`Row ${rowNumber}:`, values);
            row.eachCell((cell, colNumber) => {
                const header = headerRow.getCell(colNumber).value;
                if (cell.value instanceof Date) {
                    console.log(`Col ${colNumber} (${header}):`);
                    console.log(`  Value: ${cell.value}`);
                    console.log(`  ISO: ${cell.value.toISOString()}`);
                    console.log(`  UTC parts: ${cell.value.getUTCFullYear()}-${cell.value.getUTCMonth() + 1}-${cell.value.getUTCDate()}`);
                    console.log(`  Local parts: ${cell.value.getFullYear()}-${cell.value.getMonth() + 1}-${cell.value.getDate()}`);
                }
            });
        }
    });
}

test().catch(console.error);
