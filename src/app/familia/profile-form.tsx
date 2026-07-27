"use client";

import { useActionState, useState } from "react";
import {
  INITIAL_MEMBER_PROFILE_ACTION_STATE,
  updateMemberProfile,
} from "./actions";

export type EditableMemberProfile = {
  fullName: string;
  phone: string;
  birthDate: string;
  address: string;
  churchSinceMonth: string;
  jesusYear: number | null;
  attendedOtherChurch: boolean | null;
  previousChurchName: string;
  baptized: boolean | null;
  married: boolean | null;
  spouseName: string;
};

function choiceValue(value: boolean | null) {
  if (value === true) {
    return "sim";
  }

  if (value === false) {
    return "nao";
  }

  return "";
}

export default function ProfileForm({
  initialProfile,
}: {
  initialProfile: EditableMemberProfile;
}) {
  const [state, formAction, isPending] = useActionState(
    updateMemberProfile,
    INITIAL_MEMBER_PROFILE_ACTION_STATE,
  );
  const [attendedOtherChurch, setAttendedOtherChurch] = useState(
    choiceValue(initialProfile.attendedOtherChurch),
  );
  const [married, setMarried] = useState(
    choiceValue(initialProfile.married),
  );

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);

  return (
    <form className="family-profile-form" action={formAction}>
      <div className="family-profile-form-heading">
        <div>
          <p className="section-eyebrow">
            <span aria-hidden="true" />
            Meu perfil
          </p>
          <h2>Conte sua caminhada.</h2>
        </div>
        <p>Visível somente para você e para a liderança da Casa.</p>
      </div>

      <div className="family-profile-grid">
        <label className="family-profile-field-wide" htmlFor="profile-name">
          Nome completo
          <input
            id="profile-name"
            name="fullName"
            type="text"
            autoComplete="name"
            maxLength={160}
            defaultValue={initialProfile.fullName}
            required
          />
        </label>

        <label htmlFor="profile-phone">
          WhatsApp
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="(54) 99999-9999"
            defaultValue={initialProfile.phone}
            required
          />
        </label>

        <label htmlFor="profile-birth-date">
          Data de nascimento
          <input
            id="profile-birth-date"
            name="birthDate"
            type="date"
            min="1900-01-01"
            max={today}
            defaultValue={initialProfile.birthDate}
            required
          />
        </label>

        <label className="family-profile-field-wide" htmlFor="profile-address">
          Endereço completo
          <input
            id="profile-address"
            name="address"
            type="text"
            autoComplete="street-address"
            maxLength={500}
            placeholder="Rua, número, bairro e cidade"
            defaultValue={initialProfile.address}
            required
          />
        </label>

        <label htmlFor="profile-church-since">
          Desde quando frequenta a Casa?
          <input
            id="profile-church-since"
            name="churchSinceMonth"
            type="month"
            min="1900-01"
            max={currentMonth}
            defaultValue={initialProfile.churchSinceMonth}
            required
          />
          <small>Informe o mês e o ano.</small>
        </label>

        <label htmlFor="profile-jesus-year">
          Ano em que aceitou Jesus
          <input
            id="profile-jesus-year"
            name="jesusYear"
            type="number"
            inputMode="numeric"
            min={1900}
            max={currentYear}
            defaultValue={initialProfile.jesusYear ?? ""}
            required
          />
        </label>

        <fieldset className="family-profile-field-wide">
          <legend>Já frequentou outra igreja evangélica?</legend>
          <div className="family-profile-choices">
            <label>
              <input
                name="attendedOtherChurch"
                type="radio"
                value="sim"
                checked={attendedOtherChurch === "sim"}
                onChange={() => setAttendedOtherChurch("sim")}
                required
              />
              Sim
            </label>
            <label>
              <input
                name="attendedOtherChurch"
                type="radio"
                value="nao"
                checked={attendedOtherChurch === "nao"}
                onChange={() => setAttendedOtherChurch("nao")}
                required
              />
              Não
            </label>
          </div>
          {attendedOtherChurch === "sim" ? (
            <label
              className="family-profile-conditional"
              htmlFor="profile-previous-church"
            >
              Qual igreja?
              <input
                id="profile-previous-church"
                name="previousChurchName"
                type="text"
                maxLength={160}
                defaultValue={initialProfile.previousChurchName}
                required
              />
            </label>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>Já é batizado nas águas?</legend>
          <div className="family-profile-choices">
            <label>
              <input
                name="baptized"
                type="radio"
                value="sim"
                defaultChecked={initialProfile.baptized === true}
                required
              />
              Sim
            </label>
            <label>
              <input
                name="baptized"
                type="radio"
                value="nao"
                defaultChecked={initialProfile.baptized === false}
                required
              />
              Não
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>É casado?</legend>
          <div className="family-profile-choices">
            <label>
              <input
                name="married"
                type="radio"
                value="sim"
                checked={married === "sim"}
                onChange={() => setMarried("sim")}
                required
              />
              Sim
            </label>
            <label>
              <input
                name="married"
                type="radio"
                value="nao"
                checked={married === "nao"}
                onChange={() => setMarried("nao")}
                required
              />
              Não
            </label>
          </div>
          {married === "sim" ? (
            <label
              className="family-profile-conditional"
              htmlFor="profile-spouse"
            >
              Nome do cônjuge
              <input
                id="profile-spouse"
                name="spouseName"
                type="text"
                autoComplete="name"
                maxLength={160}
                defaultValue={initialProfile.spouseName}
                required
              />
            </label>
          ) : null}
        </fieldset>
      </div>

      <div className="family-profile-save-row">
        <p
          data-kind={state.kind}
          role={state.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.kind === "idle"
            ? "Preencha todos os campos para liberar sua recompensa."
            : state.message}
        </p>
        <button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar meu perfil"}
        </button>
      </div>
    </form>
  );
}
