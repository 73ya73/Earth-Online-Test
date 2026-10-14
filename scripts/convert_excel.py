import json, re, sys
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv)>1 else Path(r'C:\Users\41773\Downloads\地球Online - 精神回血系统检测.xlsx')
wb = openpyxl.load_workbook(source, data_only=True)
keys = ['ACT','RESET','SOCIAL','LUCK','THINK','SAVE']
questions=[]
warnings=[]
blank_count=0
for row_number,row in enumerate(wb['分数'].values,1):
    text=row[0]
    if not isinstance(text,str): continue
    if re.match(r'^Q\d+\s',text):
        qid=re.match(r'^(Q\d+)',text)[1]
        q={'questionId':qid,'text':text,'scoringEnabled':row[3]=='是','answerNature':row[4],'options':[]}
        questions.append(q)
    elif re.match(r'^[A-G]\.',text):
        scores={}
        for key,value in zip(keys,row[5:11]):
            if value is None:
                scores[key]=None
                blank_count+=1
            elif isinstance(value,(int,float)) and not isinstance(value,bool): scores[key]=value
            else: raise ValueError(f'无法解析 {row_number}: {key}={value!r}')
        q['options'].append({'questionId':q['questionId'],'optionId':text[0],'text':text,'answerNature':q['answerNature'],'behaviorTag':row[2],'scoringEnabled':q['scoringEnabled'],'scores':scores,'sourceRow':row_number})
assert len(questions)==12
assert [len(q['options']) for q in questions]==[4,6,4,5,5,5,4,5,7,5,5,5]
for q in questions:
    for o in q['options']:
        if not o['scoringEnabled'] and any(isinstance(v,(int,float)) and v!=0 for v in o['scores'].values()): raise ValueError('非计分题包含分数')
maxima={k:sum(max([o['scores'][k] or 0 for o in q['options']]) for q in questions if q['scoringEnabled']) for k in keys}
evidence={k:sum(any((o['scores'][k] or 0)>0 for o in q['options']) for q in questions if q['scoringEnabled']) for k in keys}
out=root/'src/data/questions.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(questions,ensure_ascii=False,indent=2),encoding='utf-8')
report={'questions':len(questions),'options':sum(len(q['options']) for q in questions),'optionCounts':[len(q['options']) for q in questions],'fields':keys,'theoreticalMaxima':maxima,'evidenceQuestions':evidence,'undefinedScoreCells':blank_count,'warnings':['空白分数保留为 null；仅累加明确数字，不为 null 赋分。空白含义仍需数据作者确认。','Q9-D 标签 T02 暂停休整，明确分数 THINK=2；按原表保留。','Q1-Q3 没有行为标签，保留 null，不自行编造。','原文 REST/RESET 与 Excel Reset 统一为 RESET；Lucky 映射为 LUCK。','候选规则待用户研究校准：归一化得分、至少两道正分证据、并列共同展示、差距不超过 0.1 展示混合倾向。']}
(root/'reports').mkdir(exist_ok=True)
(root/'reports/data-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
