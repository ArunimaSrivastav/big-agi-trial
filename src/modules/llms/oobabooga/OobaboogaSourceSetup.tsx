import * as React from 'react';

import { Alert, Box, Button, FormControl, FormHelperText, FormLabel, Input, Typography } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';
import { Link } from '~/common/components/Link';
import { settingsCol1Width, settingsGap } from '~/common/theme';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { LLMOptionsOpenAI, normalizeOAISetup } from '../openai/openai.vendor';
import { OpenAI } from '../openai/openai.types';
import { normalizeOobaboogaSetup, SourceSetupOobabooga } from './oobabooga.vendor';
import { useModelsStore, useSourceSetup } from '../store-llms';


export function OobaboogaSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, sourceLLMs, updateSetup, normSetup,
  } = useSourceSetup<SourceSetupOobabooga>(props.sourceId, normalizeOobaboogaSetup);


  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } = apiQuery.openai.listModels.useQuery({
    access: normalizeOAISetup(normSetup),
  }, {
    enabled: false, //!hasModels && !!asValidURL(normSetup.oaiHost),
    onSuccess: models => {
      console.log('OobaboogaSourceSetup: models', models);
      const llms = source ? models.map(model => oobaboogaModelToDLLM(model, source)).filter(model => !!model) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
    refetchOnMount: 'always',
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <Typography>
      You can use a running <Link href='https://github.com/oobabooga/text-generation-webui' target='_blank'>
      text-generation-webui</Link> instance as a source for models.
      Follow <Link href='https://github.com/enricoros/big-agi/blob/main/docs/local-llm-text-web-ui.md' target='_blank'>
      the instructions</Link> to set up the server.
    </Typography>

    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          API Base
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          Excluding /v1
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='http://127.0.0.1:5001'
        value={normSetup.oaiHost} onChange={event => updateSetup({ oaiHost: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>

    <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
      <Button
        variant='solid' color={isError ? 'warning' : 'primary'}
        disabled={!(normSetup.oaiHost.length >= 7) || isFetching}
        endDecorator={<SyncIcon />}
        onClick={() => refetch()}
        sx={{ minWidth: 120, ml: 'auto' }}
      >
        Models
      </Button>
    </Box>

    {isError && <Alert variant='soft' color='warning' sx={{ mt: 1 }}><Typography>Issue: {error?.message || error?.toString() || 'unknown'}</Typography></Alert>}

  </Box>;
}

const NotChatModels: string[] = [
  'text-curie-001', 'text-davinci-002',
];


function oobaboogaModelToDLLM(model: OpenAI.Wire.Models.ModelDescription, source: DModelSource): (DLLM & { options: LLMOptionsOpenAI }) {
  const label = model.id.replaceAll(/[_-]/g, ' ').split(' ').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  // TODO - figure out how to the context window size from Oobabooga
  const contextTokens = 4096;
  return {
    id: `${source.id}-${model.id}`,
    label,
    created: model.created || Math.round(Date.now() / 1000),
    description: 'Oobabooga model',
    tags: [], // ['stream', 'chat'],
    contextTokens,
    hidden: NotChatModels.includes(model.id),
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(contextTokens / 8),
    },
  };
}