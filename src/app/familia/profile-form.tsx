"use client";

import { useActionState, useState } from "react";
import {
  type MemberProfileActionState,
  updateMemberProfile,
} from "./actions";

const INITIAL_MEMBER_PROFILE_ACTION_STATE: MemberProfileActionState = {
  kind: "idle",
  message: "",
  earnedStar: null,
};

export type EditableMemberProfile = {
  fullName: string;
  phone: string;
  birthDate: string;
  gender: string | null;
  address: string;
  churchSinceMonth: string;
  jesusYear: number | null;
  attendedOtherChurch: boolean | null;
  previousChurchName: string;
  baptized: boolean | null;
  married: boolean | null;
  spouseName: string;
  hasDiscipler: boolean | null;
  servesMinistry: boolean | null;
};

export type ProfileChoiceOption = { value: string; label: string };

function choiceValue(value: boolean | null) {
  if (value === true) {
    return "sim";
  }

  if (value === false) {
    return "nao";
  }

  return "";
}

function birthDateParts(value: string) {
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
}

export default function ProfileForm({
  initialProfile,
  ministries,
  disciplers,
  initialMinistryKeys,
  initialDisciplerId,
}: {
  initialProfile: EditableMemberProfile;
  ministries: ProfileChoiceOption[];
  disciplers: ProfileChoiceOption[];
  initialMinistryKeys: string[];
  initialDisciplerId: string;
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
  const [hasDiscipler, setHasDiscipler] = useState(choiceValue(initialProfile.hasDiscipler));
  const [servesMinistry, setServesMinistry] = useState(choiceValue(initialProfile.servesMinistry));
  const [birthDate, setBirthDate] = useState(() => birthDateParts(initialProfile.birthDate));

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const currentYear = Number(today.slice(0, 4));
  const selectedYear = Number(birthDate.year || currentYear);
  const selectedMonth = Number(birthDate.month || 1);
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const birthDateValue = birthDate.year && birthDate.month && birthDate.day
    ? `${birthDate.year}-${birthDate.month}-${birthDate.day}`
    : "";

  function updateBirthDate(part: "day" | "month" | "year", value: string) {
    setBirthDate((current) => {
      const next = { ...current, [part]: value };
      const year = Number(next.year || currentYear);
      const month = Number(next.month || 1);
      const maximumDay = new Date(year, month, 0).getDate();
      if (Number(next.day) > maximumDay) next.day = String(maximumDay).padStart(2, "0");
      return next;
    });
  }

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

        <fieldset className="family-birth-date">
          <legend>Data de nascimento</legend>
          <input name="birthDate" type="hidden" value={birthDateValue} />
          <div>
            <select aria-label="Dia de nascimento" value={birthDate.day} onChange={(event) => updateBirthDate("day", event.target.value)} required>
              <option value="">Dia</option>
              {Array.from({ length: daysInSelectedMonth }, (_, index) => String(index + 1).padStart(2, "0")).map((day) => <option value={day} key={day}>{day}</option>)}
            </select>
            <select aria-label="Mês de nascimento" value={birthDate.month} onChange={(event) => updateBirthDate("month", event.target.value)} required>
              <option value="">Mês</option>
              {[["01", "Janeiro"], ["02", "Fevereiro"], ["03", "Março"], ["04", "Abril"], ["05", "Maio"], ["06", "Junho"], ["07", "Julho"], ["08", "Agosto"], ["09", "Setembro"], ["10", "Outubro"], ["11", "Novembro"], ["12", "Dezembro"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select aria-label="Ano de nascimento" value={birthDate.year} onChange={(event) => updateBirthDate("year", event.target.value)} required>
              <option value="">Ano</option>
              {Array.from({ length: currentYear - 1899 }, (_, index) => String(currentYear - index)).map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
          </div>
          <small>Escolha o dia, o mês e o ano.</small>
        </fieldset>

        <fieldset>
          <legend>Sexo</legend>
          <div className="family-profile-choices">
            <label>
              <input name="gender" type="radio" value="masculino" defaultChecked={initialProfile.gender === "masculino"} required />
              Masculino
            </label>
            <label>
              <input name="gender" type="radio" value="feminino" defaultChecked={initialProfile.gender === "feminino"} required />
              Feminino
            </label>
          </div>
        </fieldset>

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

        <fieldset className="family-profile-field-wide family-profile-role-choice">
          <legend>Você tem discipulador?</legend>
          <div className="family-profile-choices">
            <label><input name="hasDiscipler" type="radio" value="sim" checked={hasDiscipler === "sim"} onChange={() => setHasDiscipler("sim")} required />Sim</label>
            <label><input name="hasDiscipler" type="radio" value="nao" checked={hasDiscipler === "nao"} onChange={() => setHasDiscipler("nao")} required />Não</label>
          </div>
          {hasDiscipler === "sim" ? (
            <label className="family-profile-conditional" htmlFor="profile-discipler">Quem é seu discipulador?
              <select id="profile-discipler" name="disciplerId" defaultValue={initialDisciplerId} required>
                <option value="">Escolha uma pessoa</option>
                {disciplers.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
          ) : null}
        </fieldset>

        <fieldset className="family-profile-field-wide family-profile-role-choice">
          <legend>Você já serve em algum ministério?</legend>
          <div className="family-profile-choices">
            <label><input name="servesMinistry" type="radio" value="sim" checked={servesMinistry === "sim"} onChange={() => setServesMinistry("sim")} required />Sim</label>
            <label><input name="servesMinistry" type="radio" value="nao" checked={servesMinistry === "nao"} onChange={() => setServesMinistry("nao")} required />Não</label>
          </div>
          {servesMinistry === "sim" ? (
            <div className="family-profile-ministry-options" aria-label="Ministérios em que você serve">
              {ministries.map((item) => <label key={item.value}><input type="checkbox" name="ministryKeys" value={item.value} defaultChecked={initialMinistryKeys.includes(item.value)} />{item.label}</label>)}
            </div>
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
