const ExcelJS = require('exceljs');

// Takes an excel file and turns the data into a plain data object.
async function parseExcel(excelBlob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBlob);
  const data = {};
  workbook.eachSheet((worksheet, sheetId) => {
    const sheetData = [];
    worksheet.eachRow((row, rowNumber) => {
      const cleanvalues = row.values.map((v) => {
        if (isNaN(v)) {
          return v.trim();
        }
        return Number(v);
      });

      // Excel is 1 indexed, so the cleanvalues element 0 is empty and
      // can be overwritten.
      if (rowNumber === 1) {
        cleanvalues[0] = 'row';
      } else {
        cleanvalues[0] = rowNumber;
      }

      sheetData.push(cleanvalues);
    });
    data[worksheet.name] = sheetData;
  });
  return data;
}

module.exports = { parseExcel };
