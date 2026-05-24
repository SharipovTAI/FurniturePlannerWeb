/**
 * Configuration - Global constants and configuration
 */

// API Configuration
const API_URL = '/api';

// Canvas Configuration
const SNAP_DISTANCE = 15;
const SNAP_LINE_COLOR = '#FF6B6B';
const CANVAS_CM_PER_UNIT = 1;
const WALL_SNAP_DISTANCE = 20; // Larger snap distance for wall endpoints
const ATTACH_DISTANCE = 35; // Distance for attaching openings to walls
const DETACH_DISTANCE = 55; // Hysteresis distance for detaching

// Lighting Configuration
const LAMP_RADIUS = 180;
const WINDOW_RADIUS = 250;
const LIGHTING_GRID_SIZE = 1; // Grid resolution for lighting analysis (lower = more precise)
const LIGHTING_ANALYSIS_WIDTH = 2000;
const LIGHTING_ANALYSIS_HEIGHT = 1600;

// Furniture & Walls Data
const furnitureItems = [
  { type: 'furniture', subtype: 'table', name: 'Стол', width: 100, height: 100, color: '#8B4513' },
  { type: 'furniture', subtype: 'chair', name: 'Стул', width: 50, height: 50, color: '#654321' },
  { type: 'furniture', subtype: 'sofa', name: 'Диван', width: 150, height: 150, color: '#4169E1' },
  { type: 'furniture', subtype: 'cabinet', name: 'Шкаф', width: 80, height: 80, color: '#8B4513' },
  { type: 'furniture', subtype: 'bed', name: 'Кровать', width: 80, height: 160, color: '#FF6347' },
  { type: 'furniture', subtype: 'toilet', name: 'Унитаз', width: 45, height: 65, color: '#cfd8dc' },
  { type: 'furniture', subtype: 'bathtub', name: 'Ванна', width: 170, height: 75, color: '#90caf9' },
  { type: 'furniture', subtype: 'microwave', name: 'Микроволновка', width: 50, height: 35, color: '#424242' },
  { type: 'furniture', subtype: 'stove', name: 'Плита', width: 60, height: 60, color: '#37474f' },
  { type: 'furniture', subtype: 'lamp', name: 'Лампа', width: 30, height: 30, color: '#FFD700' },
];

const wallItems = [
  { type: 'wall', subtype: 'standard', name: 'Стена', width: 240, height: 12, color: '#4f4f4f' },
];

const openingItems = [
  // width: size along wall; thickness is forced to wall thickness on placement
  { type: 'opening', subtype: 'door', name: 'Дверь', width: 80, height: 12, color: '#2d6a4f' },
  { type: 'opening', subtype: 'window', name: 'Окно', width: 60, height: 12, color: '#1d4ed8' },
];

// Room Type Labels and Categories
const SPECIAL_ROOM_CATEGORY_LABEL = {
  bedroom: 'Спальня',
  bathroom: 'Санузел',
  kitchen: 'Кухня',
};

const SPECIAL_CATEGORY_RESOLVE_HINT = {
  bedroom: { label: 'Спальня', keep: 'кровать' },
  bathroom: { label: 'Санузел', keep: 'унитаз и/или ванну' },
  kitchen: { label: 'Кухня', keep: 'плиту и/или микроволновку' },
};

// Room Detection Configuration
const CONNECT_EPS = 8; // Epsilon for wall connection detection

// Keyboard Movement Configuration
const KEYBOARD_STEP = 1;
const KEYBOARD_MOVE_INTERVAL = 30; // milliseconds

// UI Colors for Rooms
const ROOM_COLORS = ['#949494', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5'];
