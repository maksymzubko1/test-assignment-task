import {useCallback, useEffect, useState} from "react";
import {json} from "@remix-run/node";
import {Form, useLoaderData} from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  VerticalStack,
  Card,
  Button,
  Box,
  Tabs,
} from "@shopify/polaris";
import {authenticate} from "../shopify.server";

export const loader = async ({request}) => {
  try {
    const {session, admin} = await authenticate.admin(request);

    const themes = await admin.rest.resources
      .Theme.all({session});
    const mainTheme = themes.data.find(t => t.role === 'main');

    const result = await admin.rest.resources
      .Asset.all({session, theme_id: mainTheme?.id});

    const pattern = getPattern();

    return json({data: result.data.filter(item => pattern.test(item.key ?? ""))});
  } catch (error) {
    console.error('Error fetching:', error);
    return json({error: 'Failed to fetch'}, 500);
  }
};

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
}

export let action = async ({request}) => {
  try {
    const {session, admin} = await authenticate.admin(request);

    const body = await request.formData();
    const selectedAssetKey = body.get('selectedAssetKey');
    const selectedAssetThemeId = body.get('selectedAssetThemeId');

    const assets = await admin.rest.resources
      .Asset.all({session, theme_id: selectedAssetThemeId});

    const variant = selectedAssetKey.replace('templates/', '')
      .split('.').at(0);
    const pattern = getPattern(variant);

    const filteredAssets = assets.data.filter(item => pattern.test(item.key ?? ""));
    let duplicatedAsset = new admin.rest.resources.Asset({session});

    let uniqueKey = `templates/${variant}.${generateRandomString(10)}.liquid`;
    while (filteredAssets.findIndex(_asset => _asset.key === uniqueKey) !== -1)
      uniqueKey = `templates/${variant}.${generateRandomString(10)}.liquid`;

    duplicatedAsset.key = uniqueKey;
    duplicatedAsset.source_key = selectedAssetKey;
    duplicatedAsset.theme_id = selectedAssetThemeId;

    await duplicatedAsset.save({update: true});
    return json({status: 'success'});
  } catch (error) {
    console.error('Error action:', error);
    return json({error: 'Failed to action'}, 500);
  }
};

function getPattern(name = "") {
  switch (name) {
    case '0':
      return /^templates\/index.*$/;
    case '1':
      return /^templates\/collection.*$/;
    case '2':
      return /^templates\/product.*$/;
    case 'index':
      return /^templates\/index.*$/;
    case 'collection':
      return /^templates\/collection.*$/;
    case 'product':
      return /^templates\/product.*$/;
    default:
      return /^templates\/(index|collection|product).*$/;
  }
}

const tabs = [
  {
    id: 'home',
    content: 'Home Pages',
    panelID: 'home-content',
  },
  {
    id: 'collection',
    content: 'Collection Pages',
    panelID: 'collection-content',
  },
  {
    id: 'product',
    content: 'Product Pages',
    panelID: 'product-content',
  },
];

export default function Index() {
  const {data} = useLoaderData();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(()=>{
    setSelectedAsset(null)
  }, [data])

  const handleTabChange = useCallback(
    (_selectedTabIndex) => {
      setSelectedTabIndex(_selectedTabIndex);
      setSelectedAsset(null);
    },
    [],
  );

  const listOfAssets = useCallback(() => {
    if (!data)
      return [];

    return data.filter((_asset) => getPattern(String(selectedTabIndex)).test(_asset?.key));
  }, [selectedTabIndex, data])

  const handleSelect = (asset) => {
    setSelectedAsset(asset);
  };

  const renderCard = (asset) => {
    const isAssetSelected = selectedAsset && selectedAsset?.key === asset.key;
    return (
      <div key={asset.key} onClick={() => handleSelect(asset)} style={{cursor: "pointer"}}>
        <Box
          borderColor={isAssetSelected ? 'border-success' : 'border-subdued'}
          borderWidth={"1"}
          borderRadius={"100"}
          padding={"5"}
        >
          <Text as={"p"}>Asset Key: {asset.key}</Text>
          <Text as={"p"}>Theme ID: {asset.theme_id}</Text>
          <Text as={"p"}>Updated At: {asset.updated_at}</Text>
        </Box>
      </div>
    )
  };

  return (
    <Page>
      <ui-title-bar title="Remix app template"></ui-title-bar>
      <VerticalStack gap="5">
        <Layout>
          <Layout.Section>
            <Card>
              <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={handleTabChange}>
                <Box padding={"2"}>
                  <VerticalStack gap={"3"}>
                    {listOfAssets().map(item => renderCard(item))}
                  </VerticalStack>
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
        <Form method="post">
          <input type="hidden" name="selectedAssetKey" value={selectedAsset ? selectedAsset?.key : ''}/>
          <input type="hidden" name="selectedAssetThemeId" value={selectedAsset ? selectedAsset?.theme_id : ''}/>
          <Button
            primary
            disabled={!selectedAsset}
            submit
          >
            Duplicate Template
          </Button>
        </Form>
      </VerticalStack>
    </Page>
  );
}
