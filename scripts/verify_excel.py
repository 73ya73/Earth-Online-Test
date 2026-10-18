import json,re,sys
from pathlib import Path
import openpyxl
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path(r'C:\Users\41773\Downloads\分数 (7).xlsx')
rows=list(openpyxl.load_workbook(source,data_only=True)['分数'].values)
data=json.loads((root/'src/data/questions.json').read_text(encoding='utf-8'))
keys=['ACT','RESET','SOCIAL','LUCKY','THINK','SAVE']
seen=[];numeric=0;nulls=0
for q in data:
    raw=next(row for row in rows if row[0]==q['text'])
    assert q['scoringEnabled']==(raw[3]=='是')
    assert q['answerNature']==raw[4]
    for o in q['options']:
        row=rows[o['sourceRow']-1]
        assert row[0]==o['text'],f"文案不符: {q['questionId']}-{o['optionId']}"
        assert row[2]==o['behaviorTag']
        for key,cell in zip(keys,row[5:11]):
            assert o['scores'][key]==cell,f"分数不符: {q['questionId']}-{o['optionId']} {key}"
            numeric+=isinstance(cell,(int,float));nulls+=cell is None
        seen.append(o['sourceRow'])
source_rows=[i for i,row in enumerate(rows,1) if isinstance(row[0],str) and re.match(r'^[A-G]\.',row[0])]
assert sorted(seen)==source_rows,'遗漏或重复解析 Excel 选项'
report={'source':source.name,'questions':len(data),'verifiedOptions':len(seen),'verifiedScoreCells':len(seen)*6,'explicitNumericCells':numeric,'undefinedCells':nulls,'result':'All question texts, option texts, ordering, scoring flags, nature, tags and F–K cell values match.'}
(root/'reports/excel-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
