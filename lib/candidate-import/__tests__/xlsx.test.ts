import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { cellToString, parseXlsxToTable } from '@/lib/candidate-import/xlsx'

describe('cellToString', () => {
  it('flattens the value shapes ExcelJS produces', () => {
    expect(cellToString('Jane')).toBe('Jane')
    expect(cellToString(8)).toBe('8')
    expect(cellToString(null)).toBe('')
    expect(cellToString(undefined)).toBe('')
    expect(cellToString({ result: 42 })).toBe('42') // formula
    expect(cellToString({ text: 'label', hyperlink: 'https://x' })).toBe('label')
    expect(cellToString({ richText: [{ text: 'Eng' }, { text: 'lish' }] })).toBe('English')
    expect(cellToString({ error: '#DIV/0!' })).toBe('')
  })
})

describe('parseXlsxToTable — round-trip', () => {
  it('reads a header row + data rows as a string table', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Candidates')
    ws.addRow(['first_name', 'last_name', 'email', 'years_of_experience'])
    ws.addRow(['Jane', 'Doe', 'jane@example.com', 8]) // number cell → string
    ws.addRow(['John', 'Roe', '', ''])
    const buffer = await wb.xlsx.writeBuffer()

    const table = await parseXlsxToTable(buffer as unknown as ArrayBuffer)
    expect(table[0]).toEqual(['first_name', 'last_name', 'email', 'years_of_experience'])
    expect(table[1]).toEqual(['Jane', 'Doe', 'jane@example.com', '8'])
    expect(table[2]![0]).toBe('John')
  })
})
