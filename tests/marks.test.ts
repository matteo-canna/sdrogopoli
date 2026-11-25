import { describe, it, expect } from 'vitest';
import { inkOn, playerMarks } from '../src/ui/characters';

describe('sigle dei giocatori', () => {
  it('di solito è l\'iniziale del nome', () => {
    expect(playerMarks([{ name: 'Matteo' }, { name: 'Computer' }])).toEqual(['M', 'C']);
  });

  it('con due iniziali uguali usa due lettere', () => {
    const marks = playerMarks([{ name: 'Anna' }, { name: 'Alberto' }, { name: 'Bruno' }]);
    expect(marks).toEqual(['AN', 'AL', 'B']);
  });

  it('se anche due lettere coincidono usa il numero del posto', () => {
    expect(playerMarks([{ name: 'Anna' }, { name: 'Andrea' }])).toEqual(['1', '2']);
  });

  it('ignora spazi ed emoji all\'inizio', () => {
    expect(playerMarks([{ name: '  🎲 luca' }, { name: 'Bot' }])).toEqual(['L', 'B']);
  });
});

describe('testo leggibile', () => {
  it('scuro sui colori chiari, bianco su quelli scuri', () => {
    expect(inkOn('#f2d21b')).toBe('#1f2421');
    expect(inkOn('#1f3a7a')).toBe('#ffffff');
  });
});
