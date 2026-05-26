// Figma API Types
export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  document: FigmaNode;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  characters?: string;
  style?: Record<string, unknown>;
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  absoluteBoundingBox?: FigmaBoundingBox;
  constraints?: FigmaConstraints;
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
}

export interface FigmaFill {
  type: string;
  color?: FigmaColor;
  opacity?: number;
}

export interface FigmaStroke {
  type: string;
  color?: FigmaColor;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaConstraints {
  vertical: string;
  horizontal: string;
}

// Parsed Screen Data
export interface ParsedScreen {
  id: string;
  name: string;
  platform: 'mobile' | 'web';
  components: ParsedComponent[];
  figmaUrl: string;
}

export interface ParsedComponent {
  id: string;
  name: string;
  type: ComponentType;
  label?: string;
  placeholder?: string;
  required?: boolean;
  children?: ParsedComponent[];
}

export type ComponentType = 
  | 'header'
  | 'input'
  | 'button'
  | 'text'
  | 'image'
  | 'icon'
  | 'card'
  | 'list'
  | 'table'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'container'
  | 'unknown';

// Requirements Document
export interface RequirementsDocument {
  id: string;
  screenName: string;
  screenType?: string;
  screenPurpose?: string;
  platform: 'mobile' | 'web';
  figmaUrl: string;
  generatedAt: string;
  components: ComponentRequirement[];
  validationRules: ValidationRule[];
  screenStates: ScreenState[];
  interactions: Interaction[];
  navigationFlow: NavigationFlow;
  apiIntegrations: ApiIntegration[];
  accessProfiles?: string[];
  accessibilityChecks: string[];
  acceptanceCriteria: string[];
  testScenarios: TestScenario[];
  notes: string;
  aiGenerated?: boolean;
}

export interface ComponentRequirement {
  name: string;
  type: ComponentType | string;
  description?: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  figmaId?: string;
  validations?: string[];
  relatedComponents?: string[];
}

export interface ValidationRule {
  field: string;
  rule: string;
  errorMessage: string;
}

export interface ScreenState {
  name: string;
  description: string;
  checks: string[];
}

export interface Interaction {
  element: string;
  action: string;
  behavior: string;
}

export interface NavigationFlow {
  entry: string[];
  exit: string[];
}

export interface ApiIntegration {
  endpoint: string;
  method: string;
  trigger: string;
  payload: string;
  response: string;
}

export interface TestScenario {
  scenario: string;
  steps: string;
  expectedResult: string;
}

// Project
export interface Project {
  id: string;
  name: string;
  figmaFileKey: string;
  figmaUrl: string;
  createdAt: string;
  updatedAt: string;
  screens: ProjectScreen[];
}

export interface ProjectScreen {
  id: string;
  projectId: string;
  screenId: string;
  screenName: string;
  status: 'pending' | 'documented';
  documentPath?: string;
  generatedAt?: string;
}
