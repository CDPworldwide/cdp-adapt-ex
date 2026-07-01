/**
 * Auto-generated OpenPets client for typeform.
 *
 * Source: @openpets/typeform
 * Generated at: 2026-06-29T23:25:41.481Z
 * Filter: read
 *
 * DO NOT EDIT MANUALLY. Regenerate with:
 *   pets client typeform --tag read
 */

import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const DEFAULT_PETS_BIN = "pets"
const DEFAULT_PLUGIN = "typeform"

export interface ProviderClientOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  petsBin?: string
  plugin?: string
  timeoutMs?: number
}

export type TypeformToolName = typeof TYPEFORM_TOOL_NAMES[number]

export const TYPEFORM_TOOL_NAMES = [
  "typeform-test-connection",
  "typeform-list-forms",
  "typeform-get-form",
  "typeform-list-responses",
  "typeform-get-insights",
  "typeform-list-workspaces",
  "typeform-get-workspace",
  "typeform-list-themes",
  "typeform-get-theme",
  "typeform-list-images",
  "typeform-get-image",
  "typeform-list-webhooks",
  "typeform-get-webhook",
  "typeform-get-form-messages",
] as const

async function executePetsTool<T>(
  toolName: TypeformToolName,
  args: unknown,
  options: ProviderClientOptions
): Promise<T> {
  const cliArgs = [
    "exec",
    toolName,
    "--plugin",
    options.plugin || DEFAULT_PLUGIN,
    "--args",
    JSON.stringify(args || {}),
    "--raw"
  ]

  try {
    const { stdout } = await execFileAsync(options.petsBin || DEFAULT_PETS_BIN, cliArgs, {
      cwd: options.cwd || process.cwd(),
      env: options.env ? { ...process.env, ...options.env } : process.env,
      timeout: options.timeoutMs
    })
    const output = stdout.trim()
    if (!output) {
      return undefined as T
    }

    try {
      return JSON.parse(output) as T
    } catch {
      return output as T
    }
  } catch (error) {
    const details = error as { message?: string; stderr?: string; stdout?: string }
    const stderr = details.stderr?.trim()
    const stdout = details.stdout?.trim()
    const suffix = stderr || stdout ? `: ${stderr || stdout}` : ""
    throw new Error(`Pets tool failed: ${toolName}${suffix || (details.message ? `: ${details.message}` : "")}`)
  }
}

export type TestConnectionArgs = Record<string, never>

export interface ListFormsArgs {
  /**
   * Page number (default: 1)
   */
  page?: number
  /**
   * Results per page (default: 10, max: 200)
   */
  pageSize?: number
  /**
   * Search forms by title
   */
  search?: string
}

export interface GetFormArgs {
  /**
   * Unique ID of the typeform
   */
  uid: string
}

export interface ListResponsesArgs {
  /**
   * Unique ID of the typeform
   */
  uid: string
  /**
   * Max responses (default: 25, max: 1000)
   */
  pageSize?: number
  /**
   * Responses since this ISO 8601 datetime
   */
  since?: string
  /**
   * Responses until this ISO 8601 datetime
   */
  until?: string
  /**
   * Responses after this token
   */
  after?: string
  /**
   * Responses before this token
   */
  before?: string
  /**
   * Filter by completion status
   */
  completed?: boolean
  /**
   * Search query to filter responses
   */
  query?: string
  /**
   * Comma-separated field IDs to limit response data
   */
  fields?: string
}

export interface GetInsightsArgs {
  /**
   * Unique ID of the typeform
   */
  uid: string
}

export interface ListWorkspacesArgs {
  /**
   * Page number (default: 1)
   */
  page?: number
  /**
   * Results per page (default: 10, max: 200)
   */
  pageSize?: number
  /**
   * Search workspaces by name
   */
  search?: string
}

export interface GetWorkspaceArgs {
  /**
   * Unique ID of the workspace
   */
  id: string
}

export interface ListThemesArgs {
  /**
   * Page number (default: 1)
   */
  page?: number
  /**
   * Results per page (default: 10, max: 200)
   */
  pageSize?: number
}

export interface GetThemeArgs {
  /**
   * Unique ID of the theme
   */
  id: string
}

export type ListImagesArgs = Record<string, never>

export interface GetImageArgs {
  /**
   * Unique ID of the image
   */
  id: string
  /**
   * Image size variant
   */
  size?: "default" | "thumbnail" | "mobile"
  /**
   * Background image size
   */
  backgroundSize?: "default" | "thumbnail" | "mobile" | "tablet"
  /**
   * Choice image size
   */
  choiceSize?: "default" | "thumbnail" | "supersize" | "supermobile" | "supersizefit" | "supermobilefit"
}

export interface ListWebhooksArgs {
  /**
   * Unique ID of the typeform
   */
  uid: string
}

export interface GetWebhookArgs {
  /**
   * Unique ID of the typeform
   */
  uid: string
  /**
   * Unique tag/name of the webhook
   */
  tag: string
}

export interface GetFormMessagesArgs {
  /**
   * Unique ID of the typeform
   */
  uid: string
}

/**
 * Test Typeform connection and return account info for ConnectionDetails component
 * 
 * Tool: typeform-test-connection
 */
export async function testConnection<T = unknown>(args: TestConnectionArgs = {}, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-test-connection", args, options)
}

/**
 * List all typeforms with optional filtering and pagination
 * 
 * Tool: typeform-list-forms
 */
export async function listForms<T = unknown>(args: ListFormsArgs = {}, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-list-forms", args, options)
}

/**
 * Get detailed information about a specific typeform by UID
 * 
 * Tool: typeform-get-form
 */
export async function getForm<T = unknown>(args: GetFormArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-get-form", args, options)
}

/**
 * Get responses for a typeform with filtering options
 * 
 * Tool: typeform-list-responses
 */
export async function listResponses<T = unknown>(args: ListResponsesArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-list-responses", args, options)
}

/**
 * Get form-level and question-level insights for a typeform
 * 
 * Tool: typeform-get-insights
 */
export async function getInsights<T = unknown>(args: GetInsightsArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-get-insights", args, options)
}

/**
 * List all workspaces in your account
 * 
 * Tool: typeform-list-workspaces
 */
export async function listWorkspaces<T = unknown>(args: ListWorkspacesArgs = {}, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-list-workspaces", args, options)
}

/**
 * Get details for a specific workspace
 * 
 * Tool: typeform-get-workspace
 */
export async function getWorkspace<T = unknown>(args: GetWorkspaceArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-get-workspace", args, options)
}

/**
 * List all themes in your account
 * 
 * Tool: typeform-list-themes
 */
export async function listThemes<T = unknown>(args: ListThemesArgs = {}, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-list-themes", args, options)
}

/**
 * Get details for a specific theme
 * 
 * Tool: typeform-get-theme
 */
export async function getTheme<T = unknown>(args: GetThemeArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-get-theme", args, options)
}

/**
 * List all images in your account
 * 
 * Tool: typeform-list-images
 */
export async function listImages<T = unknown>(args: ListImagesArgs = {}, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-list-images", args, options)
}

/**
 * Get a specific image by ID with optional size
 * 
 * Tool: typeform-get-image
 */
export async function getImage<T = unknown>(args: GetImageArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-get-image", args, options)
}

/**
 * List all webhooks for a typeform
 * 
 * Tool: typeform-list-webhooks
 */
export async function listWebhooks<T = unknown>(args: ListWebhooksArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-list-webhooks", args, options)
}

/**
 * Get details for a specific webhook
 * 
 * Tool: typeform-get-webhook
 */
export async function getWebhook<T = unknown>(args: GetWebhookArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-get-webhook", args, options)
}

/**
 * Get custom messages for a typeform
 * 
 * Tool: typeform-get-form-messages
 */
export async function getFormMessages<T = unknown>(args: GetFormMessagesArgs, options: ProviderClientOptions = {}): Promise<T> {
  return executePetsTool<T>("typeform-get-form-messages", args, options)
}

export const typeformClient = {
  testConnection,
  listForms,
  getForm,
  listResponses,
  getInsights,
  listWorkspaces,
  getWorkspace,
  listThemes,
  getTheme,
  listImages,
  getImage,
  listWebhooks,
  getWebhook,
  getFormMessages,
}

export default typeformClient
