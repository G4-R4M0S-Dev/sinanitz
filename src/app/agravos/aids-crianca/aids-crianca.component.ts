import { Component } from '@angular/core';
import { FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';
import { saveAs } from 'file-saver';
import { PDFDocument } from 'pdf-lib';
import { IbgeService } from '../../services/ibge.service';
import { CnesService } from '../../services/cnes.service';
import { CepService } from '../../services/cep.service';


@Component({
  selector: 'app-aids-crianca',
  templateUrl: './aids-crianca.component.html',
  styleUrls: ['./aids-crianca.component.scss']
})
export class AidsCriancaComponent {
  form!: FormGroup;
  submitted = false;

  estados: string[] = [];
  municipiosByUF: { [key: string]: string[] } = {};
  ibgeCode: number = 0;
  estabelecimentos: any[] = [];
  selectedCnes: number = 0;
  hasError: boolean = false;


  constructor(
    private fb: FormBuilder,
    private ibgeService: IbgeService,
    private cnesService: CnesService,
    private cepService: CepService
    ) {
    this.createForm();
    this.loadEstados();
    }

  loadEstados() {
    this.ibgeService.getEstados().subscribe(response => {
      this.estados = response.map((estado:any) => estado.sigla);
    });
  }

  loadMunicipios(uf: string): string[] {
    if (!this.municipiosByUF[uf]) {
      this.ibgeService.getMunicipios(uf).subscribe(response => {
        this.municipiosByUF[uf] = response.map((municipio: any) => municipio.nome);
      });
    }
    return this.municipiosByUF[uf] || [];
  }

  loadIbgeCode(municipioNome: string, controlName: string) {
    const formattedName = this.formatStringForAPI(municipioNome);
    this.ibgeService.getMunicipioId(formattedName).subscribe(response => {
      this.ibgeCode = parseInt(response.id.toString().slice(0, -1), 10);
      this.form.get(controlName)?.setValue(this.ibgeCode);
      this.loadEstabelecimentosSaude(this.ibgeCode);
    });
  }

  loadEstabelecimentosSaude(codigo_municipio: number) {
    this.cnesService.getEstabelecimentosSaude(codigo_municipio).subscribe((response:any) => {
      this.estabelecimentos = response.flatMap((estabelecimento: any) => {
        return estabelecimento;
      });
    });
  }

  updateCnesValue(event: any, controlName: string) {
    const selectedNomeFantasia = event.target.value;
    const selectedEstabelecimento = this.estabelecimentos.find(estabelecimento => estabelecimento.nome_fantasia === selectedNomeFantasia);
    if (selectedEstabelecimento) {
        this.selectedCnes = selectedEstabelecimento.codigo_cnes;
        this.form.get(controlName)?.setValue(this.selectedCnes);
    }
  }

  onCepChange(cep: string) {
    this.cepService.getCepDetails(cep).subscribe(details => {
        this.form.get('Texto18')?.setValue(details.stateShortname);
        this.form.get('Texto19')?.setValue(details.city);
        this.form.get('Texto20')?.setValue(details.ibgeId);
        this.form.get('Texto22')?.setValue(details.district);
        this.form.get('Texto23')?.setValue(details.street);
        this.form.get('Texto26')?.setValue(details.complement);
        this.hasError = false;
    },
    error => {
      this.hasError = true;
    });
  }


  private dependenciesMap: Record<string, { observe: string, value?: any }> = {
    'Texto3':  { observe:'Texto2'},
    'Texto4':  { observe:'Texto3'},
    'Texto5':  { observe:'Texto4'},
    'Texto6':  { observe:'Texto5'},
    'Texto46':  { observe:'Texto45'},
    'Texto47':  { observe:'Texto46'},
    'Texto116':  { observe:'Texto115'},
    'Texto117':  { observe:'Texto116'},
  };

  private createForm() {
    const controls: Record<string, FormControl> = {};

    for (let i = 1; i <= 124; i++) {
      let validators = [];
      const requiredFields = [2,3,5,6,8,9,12,18,19,33,38,39,40,41,42,43,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,
      102,103,104,105,106,107,108,109,110,111,112,113,114];

      if (requiredFields.includes(i)) {
        validators.push(Validators.required);
      }

      if (Object.keys(this.dependenciesMap).includes(`Texto${i}`)) {
        controls[`Texto${i}`] = new FormControl({value: '', disabled: true}, validators);
      } else {
        if (i == 33){
          controls[`Texto${i}`] = new FormControl('Brasil', validators);
        }else{
          controls[`Texto${i}`] = new FormControl('', validators);
        }
      }
    }

    this.form = this.fb.group(controls);

    for (const dependentField in this.dependenciesMap) {
      const fieldData = this.dependenciesMap[dependentField];
      this.form.get(fieldData.observe)?.valueChanges.subscribe(value => {
        const control = this.form.get(dependentField);
        if (fieldData.value !== undefined) {
          if (value == fieldData.value) {
            control?.enable();
          } else {
            control?.disable();
          }
        } else {
          if (value) {
            control?.enable();
          } else {
            control?.disable();
          }
        }
      });
    }

    //Específico para calcular a idade
    this.form.get('Texto9')?.valueChanges.subscribe(date => {
      if (date) {
        const age = this.calculateAge(new Date(date));
        this.form.get('Texto10')?.setValue(age);
      }
    });

  }


  async onSubmit() {
    this.submitted = true;

    this.form.markAllAsTouched();

    if (this.form.invalid) {
        return; // Sai da função se o formulário for inválido.
    }

    const formValues = this.form.value;

      // Carregue seu PDF
      const pdfUrl = '../../../assets/formularios/Aids_crianca.pdf'; // Altere isso para o caminho do seu PDF
      const pdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pdfForm = pdfDoc.getForm();

      // Obter todos os campos do PDF
      const fields = pdfForm.getFields();

      // Aqui, pegue os campos do seu PDF e defina os valores
      // O nome do campo é o que está definido no seu PDF interativo
      for (let i = 1; i <= 124; i++) {
        const fieldName = `Texto${i}`;
        let fieldValue = formValues[`Texto${i}`];

        // definindo o campo 11 (tipo de idade) para 4 que é em anos.
        if (i === 11){
            fieldValue = 4;
        }

        // Verifique se o valor é booleano (campo checkbox)
        if (typeof fieldValue === 'boolean') {
            fieldValue = fieldValue ? '1' : '2';
        }

        // Converta o valor para uma string, se necessário
        if (typeof fieldValue === 'number') {
            fieldValue = fieldValue.toString();
        } else if (typeof fieldValue === 'string' && fieldValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = fieldValue.split('-');
            fieldValue = `${day}/${month}/${year}`;
        }

        const field = pdfForm.getTextField(fieldName);
        field.setText(fieldValue);
      }

      // Definir todos os campos como somente leitura
      fields.forEach(field => {
        field.enableReadOnly();
      });

      // Serialize o PDF modificado para bytes e salve-o
      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'modified_document.pdf');
    }

    generateIndices(...ranges: [number, number][]): Set<number> {
      const indices = new Set<number>();
      for (const [start, end] of ranges) {
        for (let i = start; i <= end; i++) {
          indices.add(i);
        }
      }
      return indices;
    }

    formatStringForAPI(str: string): string {
      // Normalizar a string para a forma de decomposição da Unicode e remover caracteres não ASCII
      const noAccents = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Substituir espaços por hífens
      const withHyphens = noAccents.replace(/\s+/g, '-');

      return withHyphens;
    }

    private calculateAge(birthDate: Date): number {
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
}
