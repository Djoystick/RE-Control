export interface GameVariant {
  label: string;
  archiveName: string;
  tooltip?: string;
}

export interface GameConfig {
  id: string;
  displayName: string;
  steamAppId: string;
  exeName: string;
  variants: GameVariant[];
}

export const SUPPORTED_GAMES: GameConfig[] = [
  {
    id: 'RE2',
    displayName: 'Resident Evil 2 (2019)',
    steamAppId: '883710',
    exeName: 're2.exe',
    variants: [
      { label: 'Стандартная', archiveName: 'RE2.zip' },
      {
        label: 'TDB66 (для мод-паков)',
        archiveName: 'RE2_TDB66.zip',
        tooltip: 'Выберите если используете сложные моды'
      }
    ]
  },
  {
    id: 'RE3',
    displayName: 'Resident Evil 3 (2020)',
    steamAppId: '952060',
    exeName: 're3.exe',
    variants: [
      { label: 'Стандартная', archiveName: 'RE3.zip' },
      {
        label: 'TDB67 (для мод-паков)',
        archiveName: 'RE3_TDB67.zip',
        tooltip: 'Выберите если используете сложные моды'
      }
    ]
  },
  {
    id: 'RE4',
    displayName: 'Resident Evil 4 (2023)',
    steamAppId: '2050650',
    exeName: 're4.exe',
    variants: [{ label: 'Стандартная', archiveName: 'RE4.zip' }]
  },
  {
    id: 'RE7',
    displayName: 'Resident Evil 7',
    steamAppId: '418370',
    exeName: 're7.exe',
    variants: [
      { label: 'Стандартная', archiveName: 'RE7.zip' },
      {
        label: 'TDB49 (для мод-паков)',
        archiveName: 'RE7_TDB49.zip',
        tooltip: 'Выберите если используете сложные моды'
      }
    ]
  },
  {
    id: 'RE8',
    displayName: 'Resident Evil Village',
    steamAppId: '1196590',
    exeName: 're8.exe',
    variants: [{ label: 'Стандартная', archiveName: 'RE8.zip' }]
  },
  {
    id: 'DMC5',
    displayName: 'Devil May Cry 5',
    steamAppId: '601150',
    exeName: 'DevilMayCry5.exe',
    variants: [{ label: 'Стандартная', archiveName: 'DMC5.zip' }]
  },
  {
    id: 'DD2',
    displayName: "Dragon's Dogma 2",
    steamAppId: '2054970',
    exeName: 'DD2.exe',
    variants: [{ label: 'Стандартная', archiveName: 'DD2.zip' }]
  },
  {
    id: 'MHRISE',
    displayName: 'Monster Hunter Rise',
    steamAppId: '1446780',
    exeName: 'MonsterHunterRise.exe',
    variants: [{ label: 'Стандартная', archiveName: 'MHRISE.zip' }]
  },
  {
    id: 'MHWILDS',
    displayName: 'Monster Hunter Wilds',
    steamAppId: '2246340',
    exeName: 'MonsterHunterWilds.exe',
    variants: [{ label: 'Стандартная', archiveName: 'MHWILDS.zip' }]
  },
  {
    id: 'SF6',
    displayName: 'Street Fighter 6',
    steamAppId: '1794680',
    exeName: 'StreetFighter6.exe',
    variants: [{ label: 'Стандартная', archiveName: 'SF6.zip' }]
  }
];
