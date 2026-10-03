// B&S: Rauchtest für die Handler unter api/. Dort darf KEINE Testdatei liegen — Vercel baut
// jede Datei in api/ als eigene Function —, deshalb steht er hier und läuft mit `npm test`.
//
// Geprüft wird das, was sonst erst in der Produktion auffällt: dass jede Datei sich überhaupt
// laden lässt (ein vertippter Import wirft beim ersten Aufruf 500) und einen Default-Export
// als Funktion mitbringt (Vercel ruft genau den auf). Die Liste steht ausgeschrieben da und
// wird gegen den Ordner abgeglichen: ein neuer Endpunkt fällt hier auf, statt ungeprüft
// mitzulaufen.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import activity from '../api/activity.js';
import config from '../api/config.js';
import data from '../api/data.js';
import diagnose from '../api/diagnose.js';
import rev from '../api/data/rev.js';
import logout from '../api/logout.js';
import logoutAll from '../api/logout/all.js';
import me from '../api/me.js';
import trainerPlan from '../api/trainer/plan.js';
import trainerStand from '../api/trainer/stand.js';

const HANDLER = {
  'activity.js': activity,
  'config.js': config,
  'data.js': data,
  'data/rev.js': rev,
  'diagnose.js': diagnose,
  'logout.js': logout,
  'logout/all.js': logoutAll,
  'me.js': me,
  'trainer/plan.js': trainerPlan,
  'trainer/stand.js': trainerStand
};

function dateien(ordner, praefix = '') {
  const raus = [];
  for (const e of readdirSync(new URL(ordner, import.meta.url), { withFileTypes: true })) {
    if (e.isDirectory()) raus.push(...dateien(`${ordner}${e.name}/`, `${praefix}${e.name}/`));
    else if (e.name.endsWith('.js')) raus.push(praefix + e.name);
  }
  return raus;
}

describe('api/ — Endpunkte', () => {
  it('kennt jede Datei unter api/', () => {
    expect(dateien('../api/').sort()).toEqual(Object.keys(HANDLER).sort());
  });

  it('exportiert überall einen Handler als Default', () => {
    for (const [name, handler] of Object.entries(HANDLER)) {
      expect(typeof handler, name).toBe('function');
    }
  });
});
