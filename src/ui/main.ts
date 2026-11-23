// Pagina provvisoria: verifica che UI e motore siano collegati.
// Verrà sostituita dal tabellone al passo 4 del piano.
import './style.css';
import { rollDice } from '../engine';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main>
    <h1>Sdrogopoli</h1>
    <p>Prototipo in costruzione.</p>
    <button id="roll">Lancia i dadi</button>
    <p id="result" aria-live="polite"></p>
  </main>
`;

const result = document.querySelector<HTMLParagraphElement>('#result')!;
document.querySelector<HTMLButtonElement>('#roll')!.addEventListener('click', () => {
  const roll = rollDice(Math.random);
  result.textContent = `${roll.dice[0]} + ${roll.dice[1]} = ${roll.total}${roll.isDouble ? ' (doppio!)' : ''}`;
});
