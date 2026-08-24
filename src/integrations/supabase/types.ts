export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      kategorien: {
        Row: {
          farbe: string
          id: string
          name: string
          typ: string
        }
        Insert: {
          farbe?: string
          id?: string
          name: string
          typ?: string
        }
        Update: {
          farbe?: string
          id?: string
          name?: string
          typ?: string
        }
        Relationships: []
      }
      lieferant_kategorien: {
        Row: {
          erstellt_am: string
          id: string
          kategorie: string
          lieferant_id: string
        }
        Insert: {
          erstellt_am?: string
          id?: string
          kategorie: string
          lieferant_id: string
        }
        Update: {
          erstellt_am?: string
          id?: string
          kategorie?: string
          lieferant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lieferant_kategorien_lieferant_id_fkey"
            columns: ["lieferant_id"]
            isOneToOne: false
            referencedRelation: "lieferanten"
            referencedColumns: ["id"]
          },
        ]
      }
      lieferanten: {
        Row: {
          adresse: string | null
          email: string | null
          erstellt_am: string
          iban: string | null
          id: string
          kontaktperson: string | null
          kundennummer: string | null
          name: string
          telefon: string | null
        }
        Insert: {
          adresse?: string | null
          email?: string | null
          erstellt_am?: string
          iban?: string | null
          id?: string
          kontaktperson?: string | null
          kundennummer?: string | null
          name: string
          telefon?: string | null
        }
        Update: {
          adresse?: string | null
          email?: string | null
          erstellt_am?: string
          iban?: string | null
          id?: string
          kontaktperson?: string | null
          kundennummer?: string | null
          name?: string
          telefon?: string | null
        }
        Relationships: []
      }
      produkte: {
        Row: {
          aktueller_bestand: number
          einheit: string
          erstellt_am: string
          id: string
          kategorie_id: string | null
          lieferant_id: string | null
          name: string
        }
        Insert: {
          aktueller_bestand?: number
          einheit?: string
          erstellt_am?: string
          id?: string
          kategorie_id?: string | null
          lieferant_id?: string | null
          name: string
        }
        Update: {
          aktueller_bestand?: number
          einheit?: string
          erstellt_am?: string
          id?: string
          kategorie_id?: string | null
          lieferant_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "produkte_kategorie_id_fkey"
            columns: ["kategorie_id"]
            isOneToOne: false
            referencedRelation: "kategorien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produkte_lieferant_id_fkey"
            columns: ["lieferant_id"]
            isOneToOne: false
            referencedRelation: "lieferanten"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnungen: {
        Row: {
          bezahlt: boolean
          datum: string
          erstellt_am: string
          gesamtbetrag: number
          gmail_message_id: string | null
          id: string
          lieferant_id: string | null
          pdf_url: string | null
          rechnungsnummer: string
        }
        Insert: {
          bezahlt?: boolean
          datum?: string
          erstellt_am?: string
          gesamtbetrag?: number
          gmail_message_id?: string | null
          id?: string
          lieferant_id?: string | null
          pdf_url?: string | null
          rechnungsnummer: string
        }
        Update: {
          bezahlt?: boolean
          datum?: string
          erstellt_am?: string
          gesamtbetrag?: number
          gmail_message_id?: string | null
          id?: string
          lieferant_id?: string | null
          pdf_url?: string | null
          rechnungsnummer?: string
        }
        Relationships: [
          {
            foreignKeyName: "rechnungen_lieferant_id_fkey"
            columns: ["lieferant_id"]
            isOneToOne: false
            referencedRelation: "lieferanten"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnungspositionen: {
        Row: {
          bezeichnung: string
          id: string
          kategorie_id: string | null
          menge: number
          preis: number
          produkt_id: string | null
          rechnung_id: string
        }
        Insert: {
          bezeichnung: string
          id?: string
          kategorie_id?: string | null
          menge?: number
          preis?: number
          produkt_id?: string | null
          rechnung_id: string
        }
        Update: {
          bezeichnung?: string
          id?: string
          kategorie_id?: string | null
          menge?: number
          preis?: number
          produkt_id?: string | null
          rechnung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rechnungspositionen_kategorie_id_fkey"
            columns: ["kategorie_id"]
            isOneToOne: false
            referencedRelation: "kategorien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungspositionen_produkt_id_fkey"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungspositionen_rechnung_id_fkey"
            columns: ["rechnung_id"]
            isOneToOne: false
            referencedRelation: "rechnungen"
            referencedColumns: ["id"]
          },
        ]
      }
      verkaufszahlen: {
        Row: {
          erstellt_am: string
          id: string
          monat: string
          produkt_id: string | null
          umsatz: number
          verkaufte_menge: number
        }
        Insert: {
          erstellt_am?: string
          id?: string
          monat: string
          produkt_id?: string | null
          umsatz?: number
          verkaufte_menge?: number
        }
        Update: {
          erstellt_am?: string
          id?: string
          monat?: string
          produkt_id?: string | null
          umsatz?: number
          verkaufte_menge?: number
        }
        Relationships: [
          {
            foreignKeyName: "verkaufszahlen_produkt_id_fkey"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkte"
            referencedColumns: ["id"]
          },
        ]
      }
      zaehlungen: {
        Row: {
          abgeschlossen_am: string | null
          datum: string
          id: string
          kategorie_id: string | null
          monat: string
          notiz: string | null
          status: string
        }
        Insert: {
          abgeschlossen_am?: string | null
          datum?: string
          id?: string
          kategorie_id?: string | null
          monat?: string
          notiz?: string | null
          status?: string
        }
        Update: {
          abgeschlossen_am?: string | null
          datum?: string
          id?: string
          kategorie_id?: string | null
          monat?: string
          notiz?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zaehlungen_kategorie_id_fkey"
            columns: ["kategorie_id"]
            isOneToOne: false
            referencedRelation: "kategorien"
            referencedColumns: ["id"]
          },
        ]
      }
      zaehlungspositionen: {
        Row: {
          differenz: number
          differenz_prozent: number
          id: string
          ist_bestand: number
          produkt_id: string | null
          soll_bestand: number
          zaehlung_id: string
        }
        Insert: {
          differenz?: number
          differenz_prozent?: number
          id?: string
          ist_bestand?: number
          produkt_id?: string | null
          soll_bestand?: number
          zaehlung_id: string
        }
        Update: {
          differenz?: number
          differenz_prozent?: number
          id?: string
          ist_bestand?: number
          produkt_id?: string | null
          soll_bestand?: number
          zaehlung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zaehlungspositionen_produkt_id_fkey"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlungspositionen_zaehlung_id_fkey"
            columns: ["zaehlung_id"]
            isOneToOne: false
            referencedRelation: "zaehlungen"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
