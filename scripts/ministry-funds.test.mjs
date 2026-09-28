import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCents,entryEffect,dreamProgress,validDate} from '../src/lib/ministry-funds.ts';
test('valores brasileiros sem arredondamento de ponto flutuante acumulado',()=>{
  for(const [v,n] of [['1.250,50',125050],['20',2000],['0,01',1],['250.50',25050],['1.250',125000],['R$ 30,00',3000]])assert.equal(parseCents(v),n);
  for(const v of ['-1','NaN','1e5','1,001','20 reais','','1.00.00'])assert.throws(()=>parseCents(v));
});
test('vendas e doações menos gastos; material não vira dinheiro',()=>{
  const entries=[['sale',12000],['cash_donation',5000],['expense',3000],['in_kind',10000],['withdrawal',1000],['opening_balance',2000]];
  assert.equal(entries.reduce((n,[k,v])=>n+entryEffect(k,v),0),15000);
});
test('metas não passam de 100% e saldo negativo não mostra progresso negativo',()=>{
  assert.deepEqual(dreamProgress(5000,20000),{percent:25,remaining:15000});
  assert.deepEqual(dreamProgress(25000,20000),{percent:100,remaining:0});
  assert.deepEqual(dreamProgress(-1000,20000),{percent:0,remaining:21000});
});
test('datas reais obrigatórias',()=>{
  assert.equal(validDate('2026-09-28'),'2026-09-28');
  for(const v of ['2026-02-30','2026-13-01','28/09/2026','1999-01-01'])assert.throws(()=>validDate(v));
});
