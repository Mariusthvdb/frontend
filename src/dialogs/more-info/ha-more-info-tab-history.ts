import {
  css,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { computeStateDomain } from "../../common/entity/compute_state_domain";
import "../../components/ha-circular-progress";
import "../../components/state-history-charts";
import { getRecentWithCache } from "../../data/cached-history";
import { HistoryResult } from "../../data/history";
import { getLogbookData, LogbookEntry } from "../../data/logbook";
import "../../panels/logbook/ha-logbook";
import { haStyleDialog } from "../../resources/styles";
import { HomeAssistant } from "../../types";

@customElement("ha-more-info-tab-history")
export class MoreInfoTabHistoryDialog extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property() public entityId!: string;

  @internalProperty() private _stateHistory?: HistoryResult;

  @internalProperty() private _entries?: LogbookEntry[];

  @internalProperty() private _persons = {};

  private _historyRefreshInterval?: number;

  protected render(): TemplateResult {
    if (!this.entityId) {
      return html``;
    }
    const stateObj = this.hass.states[this.entityId];

    if (!stateObj) {
      return html``;
    }

    return html`
      <state-history-charts
        up-to-now
        .hass=${this.hass}
        .historyData=${this._stateHistory}
        .isLoadingData=${!this._stateHistory}
      ></state-history-charts>
      ${!this._entries
        ? html`
            <ha-circular-progress
              active
              alt=${this.hass.localize("ui.common.loading")}
            ></ha-circular-progress>
          `
        : this._entries.length
        ? html`
            <ha-logbook
              narrow
              no-icon
              no-name
              style=${styleMap({
                height: `${(this._entries.length + 1) * 56}px`,
              })}
              .hass=${this.hass}
              .entries=${this._entries}
              .userIdToName=${this._persons}
            ></ha-logbook>
          `
        : ""}
    `;
  }

  protected firstUpdated(): void {
    this._fetchPersonNames();
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this.entityId) {
      clearInterval(this._historyRefreshInterval);
    }

    if (changedProps.has("entityId")) {
      this._stateHistory = undefined;
      this._entries = undefined;

      this._getStateHistory();
      this._getLogBookData();

      clearInterval(this._historyRefreshInterval);
      this._historyRefreshInterval = window.setInterval(() => {
        this._getStateHistory();
      }, 60 * 1000);
    }
  }

  private async _getStateHistory(): Promise<void> {
    this._stateHistory = await getRecentWithCache(
      this.hass!,
      this.entityId,
      {
        refresh: 60,
        cacheKey: `more_info.${this.entityId}`,
        hoursToShow: 24,
      },
      this.hass!.localize,
      this.hass!.language
    );
  }

  private async _getLogBookData() {
    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();
    this._entries = await getLogbookData(
      this.hass,
      yesterday.toISOString(),
      now.toISOString(),
      this.entityId,
      true
    );
  }

  private _fetchPersonNames() {
    Object.values(this.hass.states).forEach((entity) => {
      if (
        entity.attributes.user_id &&
        computeStateDomain(entity) === "person"
      ) {
        this._persons[entity.attributes.user_id] =
          entity.attributes.friendly_name;
      }
    });
  }

  static get styles() {
    return [
      haStyleDialog,
      css`
        state-history-charts {
          display: block;
          margin-bottom: 16px;
        }

        ha-logbook {
          max-height: 360px;
        }

        ha-circular-progress {
          display: flex;
          justify-content: center;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-more-info-tab-history": MoreInfoTabHistoryDialog;
  }
}
