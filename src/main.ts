import Phaser from 'phaser';
import './styles.css';
import { createInitialState } from './game/data/createInitialState';
import { loadGameData } from './game/data/loadGameData';
import { createGameConfig } from './game/config';
import { createPlatform } from './game/platform/createPlatform';
import { GameContext } from './game/systems/GameContext';
import { SaveService } from './game/systems/SaveService';
import { TimeService } from './game/systems/TimeService';

function showFatalError(error: unknown): void {
  console.error('[CloudFarm] boot failed', error);
  const splash = document.getElementById('splash');
  const container = splash ?? document.getElementById('game') ?? document.body;
  const message = document.createElement('div');
  message.style.position = 'absolute';
  message.style.inset = '0';
  message.style.zIndex = '99999';
  message.style.display = 'flex';
  message.style.flexDirection = 'column';
  message.style.alignItems = 'center';
  message.style.justifyContent = 'center';
  message.style.gap = '14px';
  message.style.padding = '24px';
  message.style.background = '#dff6ff';
  message.style.color = '#28495b';
  message.style.fontFamily = '"Trebuchet MS", sans-serif';
  message.style.textAlign = 'center';
  message.innerHTML =
    '<strong style="font-size:26px">Не удалось загрузить ферму</strong>' +
    '<span style="font-size:16px">Обнови страницу или попробуй позже.</span>';
  container.appendChild(message);
}

async function boot(): Promise<void> {
  const data = loadGameData();
  const platform = await createPlatform();
  const time = new TimeService();
  const saveService = new SaveService(platform, data, time);
  const saved = await saveService.load();
  const state = saved ?? createInitialState(data, time.now());
  const context = new GameContext({ platform, state, data, time });

  const game = new Phaser.Game(createGameConfig());
  game.registry.set('ctx', context);
  context.start();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      context.requestSave();
    }
  });
}

void boot().catch(showFatalError);
