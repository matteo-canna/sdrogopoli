// Prestiti dalla banca (compito 8), regola facoltativa del motore.
import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import {
  applyAction,
  chooseBotAction,
  createGame,
  loanRepayment,
  migrateState,
  netWorth,
  RuleError,
  LOAN_AMOUNTS,
  LOAN_ROUNDS,
  type GameContext,
  type GameRules,
  type GameState,
} from '../src/engine';
import { setLang, text } from '../src/i18n';

const ctx: GameContext = { board, cards };

function game(rules: Partial<GameRules> = { loans: true }): GameState {
  return createGame(['Ada', 'Bea'], ctx, { seatBonus: 0, ...rules }, 7);
}

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const err = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof RuleError ? e.key : String(e);
  }
  return null;
};

describe('prestiti dalla banca', () => {
  it('1. richiesta del prestito: uno alla volta, importi validi e non durante aste/scambi/carte', () => {
    let s = game();
    const before = s.players[0].money;
    expect(LOAN_AMOUNTS.map(loanRepayment)).toEqual([110, 220, 330]);
    expect(err(() => applyAction(s, { type: 'takeLoan', amount: 150 }, ctx))).toBe('err.badAmount');

    s = applyAction(s, { type: 'takeLoan', amount: 200 }, ctx);
    expect(s.players[0].money).toBe(before + 200);
    expect(s.players[0].loan).toEqual({ amount: 200, due: 220, dueRound: 1 + LOAN_ROUNDS });
    setLang('it');
    expect(s.log.map(text).some((l) => l.includes('chiede un prestito di 200'))).toBe(true);

    // non si può chiedere un secondo prestito finché il primo è attivo
    expect(err(() => applyAction(s, { type: 'takeLoan', amount: 100 }, ctx))).toBe('err.alreadyHasLoan');

    // non si può chiedere durante un'asta, uno scambio o una scelta di carta
    const inAuction = game();
    inAuction.phase = 'auction';
    expect(err(() => applyAction(inAuction, { type: 'takeLoan', amount: 100 }, ctx))).toBe('err.notNow');

    const inCard = game();
    inCard.phase = 'cardChoice';
    expect(err(() => applyAction(inCard, { type: 'takeLoan', amount: 100 }, ctx))).toBe('err.notNow');

    const inTrade = game();
    inTrade.trade = { from: 0, to: 1, give: { money: 10, spaces: [] }, get: { money: 0, spaces: [] } };
    expect(err(() => applyAction(inTrade, { type: 'takeLoan', amount: 100 }, ctx))).toBe('err.answerTradeFirst');
  });

  it('2. rimborso anticipato: estingue il debito e controlla i contanti', () => {
    let s = game();
    expect(err(() => applyAction(s, { type: 'repayLoan' }, ctx))).toBe('err.noLoan');
    s = applyAction(s, { type: 'takeLoan', amount: 300 }, ctx);
    const cashAfterLoan = s.players[0].money;

    // se i contanti non bastano, rifiuta
    s.players[0].money = 320;
    expect(err(() => applyAction(s, { type: 'repayLoan' }, ctx))).toBe('err.noMoney');

    s.players[0].money = cashAfterLoan;
    s = applyAction(s, { type: 'repayLoan' }, ctx);
    expect(s.players[0].loan).toBeNull();
    expect(s.players[0].money).toBe(cashAfterLoan - 330);
    // dopo il rimborso può chiedere un nuovo prestito
    s = applyAction(s, { type: 'takeLoan', amount: 100 }, ctx);
    expect(s.players[0].loan?.due).toBe(110);
  });

  it('3. rimborso automatico alla scadenza passando dalla Partenza', () => {
    let s = game();
    s = applyAction(s, { type: 'takeLoan', amount: 200 }, ctx);
    const startSalary = (board.spaces[0] as { salary: number }).salary;

    // prima della scadenza (giro 5 < dueRound 6) passando dalla Partenza il prestito resta attivo
    s.round = 5;
    s.players[0].position = board.spaces.length - 1;
    s.phase = 'roll';
    const beforeEarly = s.players[0].money;
    // lancio 1 + 2 = 3 -> arriva su casella 2 (sorte) oppure usiamo 1+1? No, casella 0 è Partenza: da length-2 con lancio 1+1=2 arriva su Partenza (indice 0)!
    s.players[0].position = board.spaces.length - 3;
    const stepEarly = applyAction(s, { type: 'roll' }, { ...ctx, rng: seq([0 / 6, 1 / 6]) }); // 1 + 2 = 3 -> indice 0 (Partenza)
    expect(stepEarly.players[0].loan).not.toBeNull();
    expect(stepEarly.players[0].money).toBe(beforeEarly + startSalary);

    // alla scadenza (giro 6 >= dueRound 6) passando dalla Partenza la banca trattiene il dovuto
    s.round = 6;
    s.players[0].position = board.spaces.length - 3;
    s.phase = 'roll';
    const beforeDue = s.players[0].money;
    const stepDue = applyAction(s, { type: 'roll' }, { ...ctx, rng: seq([0 / 6, 1 / 6]) });
    expect(stepDue.players[0].loan).toBeNull();
    expect(stepDue.players[0].money).toBe(beforeDue + startSalary - 220);
    expect(stepDue.log.some((l) => typeof l === 'object' && l.k === 'log.loanDue')).toBe(true);
  });

  it('4. scadenza senza abbastanza soldi: entra nella fase di debito verso la banca', () => {
    let s = game({ loans: true, parkPot: true });
    s = applyAction(s, { type: 'takeLoan', amount: 300 }, ctx);
    // portiamo il giocatore a 50 contanti: alla Partenza incassa 200 (totale 250), deve 330 -> -80
    s.players[0].money = 50;
    s.round = 1 + LOAN_ROUNDS;
    s.players[0].position = board.spaces.length - 3;
    s.phase = 'roll';
    s = applyAction(s, { type: 'roll' }, { ...ctx, rng: seq([0 / 6, 1 / 6]) }); // 1 + 2 = 3 -> casella 0 (Partenza)
    expect(s.players[0].loan).toBeNull();
    expect(s.players[0].money).toBe(-80);
    expect(s.creditor).toBeNull();
    expect(s.phase).toBe('endTurn');
    // non può chiudere il turno finché è in debito
    expect(err(() => applyAction(s, { type: 'endTurn' }, ctx))).toBe('err.payDebtFirst');
  });

  it('5. regola spenta: rifiuta richiesta e rimborso', () => {
    const off = game({ loans: false });
    expect(err(() => applyAction(off, { type: 'takeLoan', amount: 100 }, ctx))).toBe('err.loansOff');
    expect(err(() => applyAction(off, { type: 'repayLoan' }, ctx))).toBe('err.loansOff');
  });

  it('6. patrimonio (netWorth) sottrae il debito residuo e migrateState preserva compatibilità', () => {
    let s = game();
    const initialWorth = netWorth(s, ctx, 0);
    s = applyAction(s, { type: 'takeLoan', amount: 200 }, ctx);
    // riceve +200 in contanti ma ha 220 di debito -> il patrimonio scende degli interessi (20)
    expect(netWorth(s, ctx, 0)).toBe(initialWorth - 20);
    s = applyAction(s, { type: 'repayLoan' }, ctx);
    expect(netWorth(s, ctx, 0)).toBe(initialWorth - 20);

    // salvataggio vecchio senza campi loan/loans
    const raw = createGame(['Ada', 'Bea'], ctx);
    delete (raw.rules as Partial<GameRules>).loans;
    delete (raw.players[0] as { loan?: unknown }).loan;
    const migrated = migrateState(raw, ctx, 1);
    expect(migrated.rules.loans).toBeUndefined();
    expect(migrated.players[0].loan).toBeUndefined();
  });

  it('7. computer: chiede un prestito solo per evitare la bancarotta e rimborsa al doppio del dovuto', () => {
    let s = createGame(
      [
        { name: 'Bot1', isBot: true },
        { name: 'Bot2', isBot: true },
      ],
      ctx,
      { loans: true, seatBonus: 0 },
      11,
    );
    // in debito di -180 senza proprietà da vendere o ipotecare: un prestito da 200 lo salva
    s.phase = 'endTurn';
    s.players[0].money = -180;
    const action = chooseBotAction(s, ctx);
    expect(action).toEqual({ type: 'takeLoan', amount: 200 });
    s = applyAction(s, action, ctx);
    expect(s.players[0].money).toBe(20);
    expect(s.players[0].loan?.due).toBe(220);

    // con meno del doppio del dovuto (es. 400 < 440) non rimborsa ancora
    s.players[0].money = 400;
    expect(chooseBotAction(s, ctx).type).not.toBe('repayLoan');

    // appena ha almeno il doppio del dovuto (440) rimborsa
    s.players[0].money = 440;
    expect(chooseBotAction(s, ctx)).toEqual({ type: 'repayLoan' });

    // se il debito supera 300 e non ha proprietà, il prestito non basta e dichiara bancarotta
    const doomed = createGame(
      [
        { name: 'Bot1', isBot: true },
        { name: 'Bot2', isBot: true },
      ],
      ctx,
      { loans: true, seatBonus: 0 },
      12,
    );
    doomed.phase = 'endTurn';
    doomed.players[0].money = -350;
    expect(chooseBotAction(doomed, ctx)).toEqual({ type: 'bankrupt' });
  });
});
